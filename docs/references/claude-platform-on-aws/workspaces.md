

# Workspaces
<a name="workspaces"></a>

Inference and resource requests on Claude Platform on AWS target a workspace. You pass the workspace’s ID in the `anthropic-workspace-id` header on these API calls. Workspace IDs use the tagged format `wrkspc_` followed by an alphanumeric identifier (for example, `wrkspc_01AbCdEf23GhIj`). See [Obtain your workspace ID](prerequisites.md#obtain-your-workspace-id) if you don’t have it yet.

## Workspace scoping
<a name="_workspace_scoping"></a>

Workspaces are bound to a single AWS region. A workspace created in `us-west-2` can only be accessed through the `us-west-2` endpoint. Usage, quotas, cost, files, batches, and Skills all roll up per workspace, giving you per-region breakdowns in the Claude Console.

Workspaces also serve as the primary IAM resource for Claude Platform on AWS. You grant or deny access to specific workspaces through AWS IAM policies using the workspace ARN. The ARN’s resource segment is the same `wrkspc_`-prefixed ID you pass in the `anthropic-workspace-id` header:

```
arn:aws:aws-external-anthropic:{region}:{account-id}:workspace/{workspace-id}
```

For example: `arn:aws:aws-external-anthropic:us-west-2:123456789012:workspace/wrkspc_01AbCdEf23GhIj` 

See [IAM policies](iam-policies.md) for policy examples.

## Creating workspaces
<a name="_creating_workspaces"></a>

A default workspace is provisioned automatically at sign-up. Additional workspaces can be created, updated, renamed, and archived through the `/v1/organizations/workspaces` endpoints, authorized by the corresponding `aws-external-anthropic` actions (`CreateWorkspace`, `UpdateWorkspace`, `ArchiveWorkspace`); see [IAM actions](iam-actions.md).

## Setting the workspace ID in your client
<a name="_setting_the_workspace_id_in_your_client"></a>

Every data plane request must include the workspace ID in the `anthropic-workspace-id` header. When you use an Anthropic SDK’s Claude-on-AWS client, there are three ways to supply it:

1.  **Environment variable** — set `ANTHROPIC_AWS_WORKSPACE_ID`, and the client reads it automatically.

   ```
   export ANTHROPIC_AWS_WORKSPACE_ID='wrkspc_01AbCdEf23GhIj'
   ```

1.  **Constructor argument** — pass `workspaceId` / `workspace_id` (name follows the SDK’s language convention) when instantiating the client.

1.  **Per-request override** — pass the header directly on an individual request if you need to address multiple workspaces from the same client.

If you use the base `Anthropic` client (without the AWS backend), set the `anthropic-workspace-id` header explicitly on every request — see [Making requests](making-requests.md) for per-language examples. For SDK-specific argument names, refer to the [Anthropic Client SDKs documentation](https://platform.claude.com/docs/en/api/client-sdks).

## Tagging workspaces
<a name="_tagging_workspaces"></a>

Workspace tags are key-value pairs attached to a workspace. They integrate with AWS IAM for attribute-based access control, and with AWS Cost and Usage Reports for cost allocation (see [Monitoring and logging](monitoring.md) for CUR details). Tagging is GA on Claude Platform on AWS.

Update tags on the existing workspace with `TagResource` and `UntagResource` in the `aws-external-anthropic` namespace. The same tag keys can drive IAM conditions and cost allocation without additional configuration.

### Tag-based access control
<a name="_tag_based_access_control"></a>

You can gate `aws-external-anthropic` actions on workspace tag values using the `aws:ResourceTag/<key>` condition context key. The following policy allows inference only on workspaces tagged `Environment=production`:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "aws-external-anthropic:CreateInference",
        "aws-external-anthropic:CreateBatchInference",
        "aws-external-anthropic:CountTokens"
      ],
      "Resource": "arn:aws:aws-external-anthropic:*:*:workspace/*",
      "Condition": {
        "StringEquals": {
          "aws:ResourceTag/Environment": "production"
        }
      }
    }
  ]
}
```

Use `aws:RequestTag/<key>` and `aws:TagKeys` condition keys on `TagResource` to enforce tagging policies (for example, requiring the workspace to carry `CostCenter` and `Owner` tags). See [IAM policies](iam-policies.md) for more examples.