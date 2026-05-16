# Claude Platform on AWS — 移行検討用サマリ

参照: https://docs.aws.amazon.com/claude-platform/latest/userguide/welcome.html
取得日: 2026-05-16

## 1. これは何か (1 行)

**Anthropic ネイティブの Claude Platform に AWS アカウントからアクセスできる新サービス**。AWS は認証層 (IAM/SigV4) と請求統合だけを提供し、推論スタックは Anthropic が運営。Amazon Bedrock とは別物 (Bedrock は AWS が運営)。

## 2. 認証 (我々の Plugin にとって最重要)

| 方法 | 概要 | 我々のユースケース適合 |
|---|---|---|
| **SigV4 (推奨)** | AWS IAM Role / User の credential を SigV4 で署名 | エンタープライズ向け |
| **API Key** | AWS Console → Claude Platform on AWS → API Keys で発行。Bearer token として送信 | 開発・ローカル向け。`aws-external-anthropic:CallWithBearerToken` IAM 権限が必要 |
| **短期 API Key** | `aws/token-generator-for-aws-external-anthropic-js` 等の SDK で IAM credential → 12h 有効の bearer token を mint | **我々の Plugin にぴったり** (Worker が IAM Role で短期 token 発行 → Plugin に渡す or Worker が代理呼出) |

> 既存の Claude Console (`platform.claude.com`) の API key はここでは使えない。**AWS Console 配下で新規発行が必要**。
> Bedrock の API Key も使えない (別 namespace)。

### Workspace ID

全データプレーンリクエストに `anthropic-workspace-id` ヘッダ必須。

## 3. エンドポイント

```
https://aws-external-anthropic.<region>.api.aws/v1/messages
```

- 利用可能リージョン: us-east-{1,2} / us-west-2 / ca-central-1 / sa-east-1 / eu-{west-1,west-2,central-1,south-1,central-2,west-3,north-1} / **ap-northeast-1 (東京)** / ap-northeast-2 / ap-southeast-{3,2,4} (= 17 リージョン)
- SDK service name: `aws-external-anthropic`

## 4. SDK

専用クライアントクラスがある (beta):

| 言語 | クラス | パッケージ |
|---|---|---|
| TypeScript | `AnthropicAws` | `@anthropic-ai/aws-sdk` |
| Python | `AnthropicAWS` | `anthropic` |
| Java | `AwsBackend.fromEnv()` で `AnthropicClient.builder()` に差し込み | `com.anthropic.aws` |
| Go / C# / PHP / Ruby | あり | 各言語 |

または **既存 `Anthropic` クライアントの `ANTHROPIC_BASE_URL` を差し替え + `anthropic-workspace-id` ヘッダ手動付与** でも動く。

## 5. API 互換性 (重要)

**Anthropic Messages API (`/v1/messages`) と同じ surface**。`anthropic-beta` ヘッダもそのまま使える。
我々が使っている Managed Agents (Agent / Session / Vault / Files / Skills) は **すべて利用可能** (beta header 経由)。

ただし以下は **Claude Platform on AWS では未提供**:

| 機能 | 影響度 |
|---|---|
| **Outcomes** (Agent session outcome tracking) | 低 (我々使ってない) |
| **Multi-agent sessions** | 低 |
| **Webhooks** (session events 受信) | **中**: 我々は polling 派なので影響なし |
| **HIPAA readiness** | (日本中小企業 kintone 顧客には影響なし) |
| **OAuth authentication** | 低 (我々は SigV4 / API key で OK) |
| **OpenAI compatible endpoints** | 低 |
| **Spend limits** | AWS Budgets で代替可 |

## 6. 我々の Plugin 設計への影響

### Auth model の選択肢 (再掲 + 具体化)

| パターン | 構成 | 評価 |
|---|---|---|
| **A: 顧客 BYO AWS** | 顧客が AWS アカウントで Claude Platform on AWS を有効化 → API Key を発行 → Plugin Config に登録 | ⭐ **現行 BYOK 思想を維持**。一番移行コスト低い |
| **B: 顧客 BYO + Cross-account IAM Role** | 顧客 AWS の IAM Role を Plugin (= ベンダー Lambda) が `sts:AssumeRole` で借りる | エンタープライズ向け、UX 複雑 |
| **C: ベンダー単一 AWS / Marketplace SaaS** | ベンダー AWS で Marketplace listing。顧客は AWS billing 経由でサブスク | 将来オプション、初期コスト高 |

**短期 API Key (12h 有効)** が用意されているので、A パターンで以下のフロー が筋がいい:
1. 顧客が AWS Console で長寿命 API Key を発行 (もしくは IAM access key 発行)
2. Plugin Config に保存 (現状の Anthropic API Key と同じ UX)
3. Worker (Lambda) が必要時に短期トークンに変換 → ヘッダ付与
   - もしくは長寿命 API Key をそのまま使用

### Worker → Lambda 移行と Anthropic → CPA 移行の組み合わせ

```
[現状]
Plugin → kintone proxy → CF Worker /anthropic/* → api.anthropic.com
                         (X-Anthropic-Api-Key 注入)

[移行後]
Plugin → kintone proxy → AWS Lambda /anthropic/* → aws-external-anthropic.ap-northeast-1.api.aws
                         (SigV4 署名 or Bearer + workspace-id ヘッダ)
```

Worker → Lambda 移行と「endpoint 切替」「workspace-id ヘッダ追加」「認証方式切替」が同一作業になる。

### Plugin Config の変更点

新規入力欄が必要 (顧客に求めるもの):
- AWS Region (例: `ap-northeast-1`)
- Anthropic Workspace ID (AWS Console で取得)
- Anthropic AWS API Key (AWS Console の Claude Platform on AWS → API Keys)
  - もしくは AWS Access Key / Secret (SigV4 用) — UX 悪い

→ **API Key 採用が現実的**。ベンダーは API Key を kintone proxy の固定ヘッダに乗せて Lambda に渡す。

## 7. CloudTrail / 監査

`aws-external-anthropic` namespace の全アクションが CloudTrail に記録される。
B2B 顧客に「全リクエストが CloudTrail で監査可能」と言えるのは強い。

## 8. 課金

AWS Marketplace バックエンド。AWS 統合請求 = 顧客の既存 AWS 請求に統合される。
ZDR (Zero Data Retention) は要 Anthropic アカウント担当への申請。

## 9. 移行プラン (改訂)

| Phase | 内容 | 工数 |
|---|---|---|
| 1 | Worker を Hono 化 (CF 上で動作確認) | S |
| 2 | AWS CDK スタック作成 (Lambda + Function URL, ap-northeast-1) | S |
| 3 | Hono の `hono/aws-lambda` adapter で deploy → 動作確認 | XS |
| 4 | Plugin Config に AWS Region / Workspace ID / AWS API Key 入力欄追加 | S |
| 5 | Worker `/anthropic/*` passthrough を `aws-external-anthropic.<region>.api.aws` 向けに改修 + `anthropic-workspace-id` ヘッダ自動付与 | M |
| 6 | E2E / 実機検証 (`/v1/messages` + Managed Agents endpoints) | M |
| 7 | promptVersion bump + Cloudflare 並行運用 → サンセット | S |

合計 **5〜7 営業日**

## 10. 確認事項 (まだ docs に書かれていない点)

- [ ] Managed Agents の endpoint path が `/v1/agents` `/v1/sessions` `/v1/files` で同じか (Messages API は同じと明記、Managed Agents は「使える」とだけ書かれている)
- [ ] Skills の `/mnt/session/outputs/` auto-collection が同じ挙動か
- [ ] AWS API Key vs 通常 Anthropic API Key の SDK 内部の挙動差
- [ ] ap-northeast-1 (東京) で全機能 (Managed Agents Beta / Files / Skills) が GA か beta か

→ **Issue #32 で実装着手前に試験デプロイ → 上記を実機確認** するのが安全
