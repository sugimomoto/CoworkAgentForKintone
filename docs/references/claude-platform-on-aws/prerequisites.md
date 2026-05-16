

# Prerequisites
<a name="prerequisites"></a>

Before making API calls, ensure you have:

1. An active AWS account with a subscription to Claude Platform on AWS (see [Set up your account](setup.md)).

1. The [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) installed and configured.

1.  **Outbound web identity federation enabled** on your AWS account (a one-time setup step; see [Enable outbound web identity federation](#enable-outbound-web-identity-federation)).

1. Your workspace ID (see [Obtain your workspace ID](#obtain-your-workspace-id)).

## Enable outbound web identity federation
<a name="enable-outbound-web-identity-federation"></a>

The Claude Platform on AWS gateway calls `sts:GetWebIdentityToken` server-side to mint a JWT it forwards to Anthropic. This STS capability is **disabled by default** on every AWS account. Enable it once per account:

```
aws iam enable-outbound-web-identity-federation
```

If the response is `[ERROR] (FeatureEnabled) …​ already enabled`, the setting is already on for your account and you can move on. Verify and retrieve your account’s issuer URL:

```
aws iam get-outbound-web-identity-federation-info
```

**Warning**  
Without this step, every request returns `"Outbound web identity federation is disabled for your account"`. This is the most common setup error.

## Obtain your workspace ID
<a name="obtain-your-workspace-id"></a>

A default workspace is provisioned automatically in each region when you sign up (see [Set up your account](setup.md)). Workspaces are bound to a single AWS region. You can find the workspace ID in the Claude Console under **Workspaces**, or in the **Workspaces** section of the AWS Console service page. See [Workspaces](workspaces.md) for region binding and IAM resource scoping.

Set the `ANTHROPIC_AWS_WORKSPACE_ID` and `AWS_REGION` environment variables so the SDK clients read them automatically:

```
export ANTHROPIC_AWS_WORKSPACE_ID='wrkspc_01AbCdEf23GhIj'
export AWS_REGION='us-west-2'
```

The region is required. The SDK client throws if no region is set. Pass `aws_region`/`awsRegion` to the constructor, or set `AWS_REGION` (or `AWS_DEFAULT_REGION`). All AWS commercial regions are supported; opt-in regions require that you first opt the account in to the region.