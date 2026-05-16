

# IAM actions for Claude Platform on AWS
<a name="iam-actions"></a>

 *IAM action reference for controlling access to Claude Platform on AWS through AWS policies.* 

Claude Platform on AWS uses AWS IAM for access control. Every API route maps to an IAM action in the `aws-external-anthropic` namespace. This page lists all actions, the routes each action authorizes, and the managed policies available for common access patterns. For platform setup and authentication, see [What is Claude Platform on AWS?](welcome.md).

## Service details
<a name="_service_details"></a>


|  |  | 
| --- |--- |
|  **IAM service prefix**  |  `aws-external-anthropic`  | 
|  **Resource types**  |  `workspace`  | 
|  **Workspace ARN**  |  `arn:aws:aws-external-anthropic:{region}:{account-id}:workspace/{workspace-id}`  | 

The ARN region is always populated and matches the region the workspace is bound to. The resource segment is the tagged workspace ID (`wrkspc_…​`), the same value you pass in the `anthropic-workspace-id` header.

## Actions
<a name="_actions"></a>

The service defines 58 actions across 14 groups. Actions follow the AWS `VerbNoun` convention and use verb discipline so that `Get*` and `List*` wildcards produce a clean read-only boundary.

### Inference
<a name="_inference"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `CreateInference`  |  `POST /v1/messages`  | 
|  `CountTokens`  |  `POST /v1/messages/count_tokens`  | 

### Batch processing
<a name="_batch_processing"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `CreateBatchInference`  |  `POST /v1/messages/batches`  | 
|  `GetBatchInference`  |  `GET /v1/messages/batches/{id}` `GET /v1/messages/batches/{id}/results`  | 
|  `ListBatchInferences`  |  `GET /v1/messages/batches`  | 
|  `CancelBatchInference`  |  `POST /v1/messages/batches/{id}/cancel`  | 
|  `DeleteBatchInference`  |  `DELETE /v1/messages/batches/{id}`  | 

### Models
<a name="_models"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `GetModel`  |  `GET /v1/models/{id}`  | 
|  `ListModels`  |  `GET /v1/models`  | 

### Files
<a name="_files"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `CreateFile`  |  `POST /v1/files`  | 
|  `GetFile`  |  `GET /v1/files/{id}` `GET /v1/files/{id}/content`  | 
|  `ListFiles`  |  `GET /v1/files`  | 
|  `DeleteFile`  |  `DELETE /v1/files/{id}`  | 

**Note**  
 `GetFile` authorizes both metadata and content download. A principal with read-only access can download file bytes, not just list files.

### Skills
<a name="_skills"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `CreateSkill`  |  `POST /v1/skills`  | 
|  `GetSkill`  |  `GET /v1/skills/{id}` `GET /v1/skills/{id}/versions` `GET /v1/skills/{id}/versions/{version}`  | 
|  `ListSkills`  |  `GET /v1/skills`  | 
|  `UpdateSkill`  |  `POST /v1/skills/{id}/versions` `DELETE /v1/skills/{id}/versions/{version}`  | 
|  `DeleteSkill`  |  `DELETE /v1/skills/{id}`  | 

**Note**  
Deleting an individual skill version maps to `UpdateSkill`, not `DeleteSkill`. A policy that denies `aws-external-anthropic:Delete*` still permits version deletion. Deny `UpdateSkill` and `CreateSkill` as well if you need to prevent any skill mutation.

### User profiles
<a name="_user_profiles"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `CreateUserProfile`  |  `POST /v1/user_profiles`  | 
|  `GetUserProfile`  |  `GET /v1/user_profiles/{id}`  | 
|  `ListUserProfiles`  |  `GET /v1/user_profiles`  | 
|  `UpdateUserProfile`  |  `POST /v1/user_profiles/{id}`  | 

**Warning**  
IAM action matching is case-insensitive. The wildcard `aws-external-anthropic:*File` matches `CreateFile`, `GetFile`, and `DeleteFile`, but does not match `ListFiles` (which ends in "files", not "file"). It also over-matches `CreateUserProfile`, `GetUserProfile`, and `UpdateUserProfile` because "Profile" ends in "file". If you intend to grant or deny only Files API actions, enumerate them explicitly (`CreateFile`, `GetFile`, `ListFiles`, `DeleteFile`) rather than using a `*File` suffix pattern.

### Agents
<a name="_agents"></a>

Agent definitions for [Claude Managed Agents](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview).


| Action | Routes authorized | 
| --- | --- | 
|  `CreateAgent`  | Agent create routes | 
|  `GetAgent`  | Agent read routes | 
|  `ListAgents`  | Agent list routes | 
|  `UpdateAgent`  | Agent update routes | 
|  `ArchiveAgent`  | Agent archive routes | 

### Sessions
<a name="_sessions"></a>

Agent sessions and event history.


| Action | Routes authorized | 
| --- | --- | 
|  `CreateSession`  | Session create routes | 
|  `GetSession`  | Session read routes | 
|  `ListSessions`  | Session list routes | 
|  `UpdateSession`  | Session update routes | 
|  `ArchiveSession`  | Session archive routes | 
|  `DeleteSession`  | Session delete routes | 

### Environments
<a name="_environments"></a>

Cloud container configurations for sessions.


| Action | Routes authorized | 
| --- | --- | 
|  `CreateEnvironment`  | Environment create routes | 
|  `GetEnvironment`  | Environment read routes | 
|  `ListEnvironments`  | Environment list routes | 
|  `UpdateEnvironment`  | Environment update routes | 
|  `ArchiveEnvironment`  | Environment archive routes | 
|  `DeleteEnvironment`  | Environment delete routes | 

### Vaults
<a name="_vaults"></a>

Credential vaults for session authentication.


| Action | Routes authorized | 
| --- | --- | 
|  `CreateVault`  | Vault create routes | 
|  `GetVault`  | Vault read routes | 
|  `ListVaults`  | Vault list routes | 
|  `UpdateVault`  | Vault update routes | 
|  `ArchiveVault`  | Vault archive routes | 
|  `DeleteVault`  | Vault delete routes | 

**Note**  
Vault operations are classified as CloudTrail Management events (rather than Data events) because vaults hold credentials and benefit from default-on audit logging. Other Claude Managed Agents operations (agents, sessions, environments, memory stores) are Data events.

### Memory stores
<a name="_memory_stores"></a>

Persistent agent memory.


| Action | Routes authorized | 
| --- | --- | 
|  `CreateMemoryStore`  | Memory store create routes | 
|  `GetMemoryStore`  | Memory store read routes | 
|  `ListMemoryStores`  | Memory store list routes | 
|  `UpdateMemoryStore`  | Memory store update routes | 
|  `ArchiveMemoryStore`  | Memory store archive routes | 
|  `DeleteMemoryStore`  | Memory store delete routes | 

**Note**  
 `GetMemoryStore` reads memory contents. The `Get*` wildcard in a managed or custom policy therefore grants memory read access. Scope policies explicitly if memory contents must be restricted.

### Workspaces
<a name="_workspaces"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `CreateWorkspace`  |  `POST /v1/organizations/workspaces`  | 
|  `GetWorkspace`  |  `GET /v1/organizations/workspaces/{id}`  | 
|  `ListWorkspaces`  |  `GET /v1/organizations/workspaces`  | 
|  `UpdateWorkspace`  |  `POST /v1/organizations/workspaces/{id}`  | 
|  `ArchiveWorkspace`  |  `POST /v1/organizations/workspaces/{id}/archive`  | 

A default workspace is provisioned at sign-up; see [Workspaces](workspaces.md).

### Authentication
<a name="_authentication"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `CallWithBearerToken`  | (none) | 

 `CallWithBearerToken` is an auth-layer permission that authorizes a principal to authenticate through an API key (bearer token) rather than AWS SigV4. It does not map to a route. Grant it alongside the route-mapped actions you want the API key holder to perform.

### Console access
<a name="_console_access"></a>


| Action | Routes authorized | 
| --- | --- | 
|  `AssumeConsole`  | (none) | 

 `AssumeConsole` authorizes a principal to open the Claude Console for a Claude Platform on AWS workspace through the AWS Console federation flow. It does not map to a route. Grant it to principals who should be able to click **Open Claude Console** on the Claude Platform on AWS service page in the AWS Console. The console capability (developer or admin) is controlled by the `aws-external-anthropic:Capability` condition key on the `AssumeConsole` action; see [IAM policies](iam-policies.md) for details on the capability model and [Using the Claude Console](console.md) for the sign-in flow.

**Warning**  
 `aws-external-anthropic:AssumeConsole` issues a Claude Console session that lasts up to 12 hours, independent of the caller’s own session duration. A caller whose IAM session is shorter than 12 hours can still obtain a console session that outlives their source credentials. Restrict this permission to principals who require Claude Console access, and revoke it promptly when no longer needed.

**Note**  
Actions performed inside the Claude Console after federation are not recorded in AWS CloudTrail or attributable through IAM. This includes global, workspace-scoped activities such as viewing usage reports. If you need an audit trail for console activity, use the audit logs available in the Claude Console rather than CloudTrail.

## Route-to-action mapping
<a name="_route_to_action_mapping"></a>

The following table lists every route on Claude Platform on AWS and the IAM action required to call it. The stable route’s IAM action also authorizes requests that use the `anthropic-beta` header. CloudTrail classifies each action as either a Data event (high-volume, data-plane operations) or a Management event (control-plane operations).


| Method | Route | IAM action | CloudTrail event type | 
| --- | --- | --- | --- | 
|  `POST`  |  `/v1/messages`  |  `CreateInference`  | Data | 
|  `POST`  |  `/v1/messages/count_tokens`  |  `CountTokens`  | Data | 
|  `POST`  |  `/v1/messages/batches`  |  `CreateBatchInference`  | Data | 
|  `GET`  |  `/v1/messages/batches`  |  `ListBatchInferences`  | Data | 
|  `GET`  |  `/v1/messages/batches/{id}`  |  `GetBatchInference`  | Data | 
|  `GET`  |  `/v1/messages/batches/{id}/results`  |  `GetBatchInference`  | Data | 
|  `POST`  |  `/v1/messages/batches/{id}/cancel`  |  `CancelBatchInference`  | Data | 
|  `DELETE`  |  `/v1/messages/batches/{id}`  |  `DeleteBatchInference`  | Data | 
|  `GET`  |  `/v1/models`  |  `ListModels`  | Data | 
|  `GET`  |  `/v1/models/{id}`  |  `GetModel`  | Data | 
|  `POST`  |  `/v1/files`  |  `CreateFile`  | Data | 
|  `GET`  |  `/v1/files`  |  `ListFiles`  | Data | 
|  `GET`  |  `/v1/files/{id}`  |  `GetFile`  | Data | 
|  `GET`  |  `/v1/files/{id}/content`  |  `GetFile`  | Data | 
|  `DELETE`  |  `/v1/files/{id}`  |  `DeleteFile`  | Data | 
|  `POST`  |  `/v1/skills`  |  `CreateSkill`  | Data | 
|  `GET`  |  `/v1/skills`  |  `ListSkills`  | Data | 
|  `GET`  |  `/v1/skills/{id}`  |  `GetSkill`  | Data | 
|  `DELETE`  |  `/v1/skills/{id}`  |  `DeleteSkill`  | Data | 
|  `POST`  |  `/v1/skills/{id}/versions`  |  `UpdateSkill`  | Data | 
|  `GET`  |  `/v1/skills/{id}/versions`  |  `GetSkill`  | Data | 
|  `GET`  |  `/v1/skills/{id}/versions/{version}`  |  `GetSkill`  | Data | 
|  `DELETE`  |  `/v1/skills/{id}/versions/{version}`  |  `UpdateSkill`  | Data | 
|  `POST`  |  `/v1/user_profiles`  |  `CreateUserProfile`  | Data | 
|  `GET`  |  `/v1/user_profiles`  |  `ListUserProfiles`  | Data | 
|  `GET`  |  `/v1/user_profiles/{id}`  |  `GetUserProfile`  | Data | 
|  `POST`  |  `/v1/user_profiles/{id}`  |  `UpdateUserProfile`  | Data | 
|  `POST`  |  `/v1/organizations/workspaces`  |  `CreateWorkspace`  | Management | 
|  `GET`  |  `/v1/organizations/workspaces`  |  `ListWorkspaces`  | Management | 
|  `GET`  |  `/v1/organizations/workspaces/{id}`  |  `GetWorkspace`  | Management | 
|  `POST`  |  `/v1/organizations/workspaces/{id}`  |  `UpdateWorkspace`  | Management | 
|  `POST`  |  `/v1/organizations/workspaces/{id}/archive`  |  `ArchiveWorkspace`  | Management | 

Claude Managed Agents routes (agents, sessions, environments, vaults, memory stores) follow the same route-to-action pattern; for the complete per-route mapping, see [the Anthropic IAM actions reference](https://platform.claude.com/docs/en/api/claude-platform-on-aws-iam-actions). Vault routes are Management events; agent, session, environment, and memory store routes are Data events.

Routes not on Claude Platform on AWS are denied at the gateway by default.

## See also
<a name="_see_also"></a>
+  [IAM policies](iam-policies.md) for example policies and managed policies
+  [AWS IAM User Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) for IAM policy syntax and evaluation logic
+  [AWS CloudTrail User Guide](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/) for audit logging configuration