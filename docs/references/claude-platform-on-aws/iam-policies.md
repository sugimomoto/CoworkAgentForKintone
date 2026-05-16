

# IAM policies
<a name="iam-policies"></a>

Claude Platform on AWS integrates with AWS IAM for access control. You grant or deny access to specific API actions on specific workspaces using standard IAM policy syntax.

The SigV4 service name and IAM action namespace is `aws-external-anthropic`. Actions follow the pattern `aws-external-anthropic:<Action>` (for example, `aws-external-anthropic:CreateInference`).

## Example: deny batch inference
<a name="_example_deny_batch_inference"></a>

The following policy allows real-time inference while blocking batch processing, a common requirement for ZDR-sensitive workloads:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "aws-external-anthropic:CreateInference",
        "aws-external-anthropic:CountTokens",
        "aws-external-anthropic:GetModel",
        "aws-external-anthropic:ListModels",
        "aws-external-anthropic:GetWorkspace",
        "aws-external-anthropic:ListWorkspaces"
      ],
      "Resource": "arn:aws:aws-external-anthropic:*:*:workspace/*"
    },
    {
      "Effect": "Deny",
      "Action": [
        "aws-external-anthropic:CreateBatchInference",
        "aws-external-anthropic:GetBatchInference",
        "aws-external-anthropic:ListBatchInferences"
      ],
      "Resource": "*"
    }
  ]
}
```

The `GetBatchInference` action authorizes both the batch metadata route and the batch results route. Denying it, alongside `ListBatchInferences`, blocks both reads and batch enumeration.

The `Allow` statement enumerates specific `Get*` and `List*` actions rather than using wildcards. Wildcards would grant `GetFile` (which downloads file bytes) and other reads you may not intend; `Deny` overrides `Allow` regardless, but the explicit form is the safer pattern to model.

## Example: synchronous inference on a single workspace
<a name="_example_synchronous_inference_on_a_single_workspace"></a>

Grants the minimal permissions for an IAM principal that runs inference against one production workspace:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "aws-external-anthropic:CreateInference",
        "aws-external-anthropic:CountTokens",
        "aws-external-anthropic:Get*",
        "aws-external-anthropic:List*"
      ],
      "Resource": "arn:aws:aws-external-anthropic:us-west-2:123456789012:workspace/wrkspc_01AbCdEf23GhIj"
    }
  ]
}
```

**Note**  
The `List*` wildcard in this policy also matches `ListWorkspaces`, which is account-scoped. The workspace ARN constraint silently filters it out, so this policy does not authorize listing workspaces. If your service account needs to enumerate workspaces, add a separate `Allow` statement for `ListWorkspaces` with `Resource: "*"`.  
This policy assumes AWS SigV4 authentication. If the principal authenticates with an API key, also grant `aws-external-anthropic:CallWithBearerToken` (see [Authentication](authentication.md)).

## Example: per-customer workspace isolation
<a name="_example_per_customer_workspace_isolation"></a>

Restricts a role to a single workspace:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "aws-external-anthropic:*",
      "Resource": "arn:aws:aws-external-anthropic:us-west-2:123456789012:workspace/wrkspc_01AbCdEf23GhIj"
    },
    {
      "Effect": "Allow",
      "Action": [
        "aws-external-anthropic:CallWithBearerToken",
        "aws-external-anthropic:AssumeConsole"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note**  
The `aws-external-anthropic:*` wildcard in the first statement includes account-scoped actions (`CreateWorkspace`, `ListWorkspaces`) that the workspace ARN constraint silently filters out. This is consistent with the "isolation" intent — the role cannot create or enumerate workspaces — but the policy contains permissions that have no effect. See [Provisioning automation](#provisioning-automation) for the account-scoped pattern.  
The second statement grants `CallWithBearerToken` and `AssumeConsole` on all resources because both are route-less actions that don’t bind to a workspace ARN. Omit the second statement if the role uses SigV4 only and never federates to the Claude Console.

## Example: feature lockdown for a ZDR-sensitive workspace
<a name="_example_feature_lockdown_for_a_zdr_sensitive_workspace"></a>

Blocks batch processing and file upload on a specific workspace while leaving synchronous inference available. Useful when a workspace handles Zero Data Retention (ZDR) data that must not persist server-side. Attach this policy alongside an Allow policy such as `AnthropicLimitedAccess` or the single-workspace example above; on its own, a Deny-only policy grants no permissions:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Action": [
        "aws-external-anthropic:CreateBatchInference",
        "aws-external-anthropic:CreateFile"
      ],
      "Resource": "arn:aws:aws-external-anthropic:us-west-2:123456789012:workspace/wrkspc_01AbCdEf23GhIj"
    }
  ]
}
```

**Note**  
This deny blocks creation only. Other file and batch actions are not denied unless you list them as well. For a complete lockdown where the workspace must never hold files or batches, also deny `aws-external-anthropic:GetFile`, `aws-external-anthropic:ListFiles`, `aws-external-anthropic:DeleteFile`, `aws-external-anthropic:GetBatchInference`, `aws-external-anthropic:ListBatchInferences`, `aws-external-anthropic:CancelBatchInference`, and `aws-external-anthropic:DeleteBatchInference`.

## Example: provisioning automation
<a name="provisioning-automation"></a>

Grants a CI/CD role the actions needed to create and manage workspaces, without any inference permissions:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "aws-external-anthropic:CreateWorkspace",
        "aws-external-anthropic:GetWorkspace",
        "aws-external-anthropic:ListWorkspaces",
        "aws-external-anthropic:UpdateWorkspace",
        "aws-external-anthropic:ArchiveWorkspace"
      ],
      "Resource": "*"
    }
  ]
}
```

 `CreateWorkspace` and `ListWorkspaces` are account-scoped operations. Specifying a workspace ARN on these actions has no effect; use `Resource: "*"`.

## Managed policies
<a name="_managed_policies"></a>

AWS provides managed policies for common access patterns:
+  ** `AnthropicFullAccess`:** Grants `aws-external-anthropic:*` on all resources.
+  ** `AnthropicReadOnlyAccess`:** Grants `Get*`, `List*`, and `CallWithBearerToken` on all resources.
+  ** `AnthropicInferenceAccess`:** Grants the ReadOnly actions plus the inference actions (`CreateInference`, `CreateBatchInference`, `CancelBatchInference`, `DeleteBatchInference`, `CountTokens`) on all resources.
+  ** `AnthropicLimitedAccess`:** Grants the `AnthropicInferenceAccess` actions plus all Claude Managed Agents actions (agents, sessions, environments, vaults, memory stores) on all resources.

 `AnthropicInferenceAccess` is the narrowest managed policy sufficient to run inference. Through the `Get*` and `List*` wildcards it grants read access to every API resource in the namespace, including file content download through `GetFile` and memory contents through `GetMemoryStore`. It does not grant file or skill creation or deletion, user profile management, workspace mutation, or console federation.

**Note**  
 `AnthropicReadOnlyAccess`, `AnthropicInferenceAccess`, and `AnthropicLimitedAccess` do not grant `AssumeConsole`. Principals who need to federate to the Claude Console require a separate grant for `aws-external-anthropic:AssumeConsole` — either through `AnthropicFullAccess` or a custom policy. See [Federating to the Claude Console](#federating-to-the-claude-console).

**Note**  
 `CreateInference` and `CreateBatchInference` are separate actions. Denying one does not block the other. If you intend to prevent all model calls, deny both.

## Federating to the Claude Console
<a name="federating-to-the-claude-console"></a>

 `aws-external-anthropic:AssumeConsole` lets an IAM principal federate into the Anthropic-operated Claude Console. Access within the console is still governed by IAM for most operations, but a subset of admin operations — primarily usage views that have no corresponding IAM API — are gated on the capability the principal federated with.

Two capabilities exist:
+  ** `developer` ** — permits the operations a Claude Platform on AWS developer needs for day-to-day work: running inference from the console, reading workspace data, viewing personal usage.
+  ** `admin` ** — additionally permits admin-only console operations, including account-wide usage views and administrative settings that are not surfaced through IAM actions.

Control which capability a principal can request with the `aws-external-anthropic:Capability` condition key on the `AssumeConsole` action:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "aws-external-anthropic:AssumeConsole",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws-external-anthropic:Capability": "admin"
        }
      }
    }
  ]
}
```

 `AnthropicFullAccess` grants `AssumeConsole` with no capability restriction. For any narrower grant — developer-only console access, or admin-only access — attach a custom policy that scopes `AssumeConsole` with the `aws-external-anthropic:Capability` condition as shown above.

## Calling with bearer tokens
<a name="_calling_with_bearer_tokens"></a>

 `aws-external-anthropic:CallWithBearerToken` authorizes the SigV4-free request path used when an API key is presented as a bearer token. Any principal that will authenticate with an API key — whether through the Anthropic SDK’s `ANTHROPIC_AWS_API_KEY` environment variable or by setting the `Authorization: Bearer` header directly — needs this action on the target workspace.

This is required for API key callers in addition to the inference actions (`CreateInference`, `CreateBatchInference`, etc.). Without `CallWithBearerToken`, API key requests are rejected before reaching the inference authorization check. SigV4 callers do not need this action.

 `AnthropicReadOnlyAccess`, `AnthropicInferenceAccess`, `AnthropicLimitedAccess`, and `AnthropicFullAccess` all include `CallWithBearerToken`. If you write a custom policy for API key access, add it explicitly.

## Outbound web identity federation (required for console access)
<a name="_outbound_web_identity_federation_required_for_console_access"></a>

The Claude Console runs in Anthropic infrastructure, not AWS. When an IAM principal calls `AssumeConsole`, AWS STS issues a web identity token scoped to the Anthropic audience; the Anthropic console then accepts that token and establishes the federated session. For this to work, the AWS account must allow outbound web identity federation to the `aws-external-anthropic` audience.

Principals that call `AssumeConsole` need the following STS permissions in addition to the `aws-external-anthropic:AssumeConsole` action:
+  ** `sts:GetWebIdentityToken` ** — permits issuing the web identity token that the Anthropic console consumes.
+  ** `sts:TagGetWebIdentityToken` ** — permits attaching session tags to the web identity token. Claude Platform on AWS uses these tags to convey the principal’s capability and workspace context to the console.

Include both in the trust policy of any role that console users assume, or in the inline/managed policy attached to user identities that call `AssumeConsole` directly. `AnthropicFullAccess` includes both STS actions. Environments that deny `sts:*` at the SCP or permission boundary level must explicitly allow these two actions for console federation to succeed.