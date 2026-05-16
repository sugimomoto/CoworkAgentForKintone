

# Using the Claude Console
<a name="console"></a>

Claude Platform on AWS uses the standard Claude Console at [platform.claude.com](https://platform.claude.com). When you sign in from the AWS Console, an **Account managed by AWS** indicator appears in the bottom-left of the Claude Console sidebar and the Console scopes to your Claude Platform on AWS organization. It provides usage analytics, cost breakdowns, rate limit visibility, workspace visibility, and pages for managing files, Agent Skills, batch jobs, agents, sessions, environments, credential vaults, and memory stores.

## Signing in
<a name="_signing_in"></a>

Access to the Claude Console is federated through AWS IAM. See [Set up your account](setup.md) for the full first-time sign-in flow. In short:

1. Assume an IAM role with the `aws-external-anthropic:AssumeConsole` permission. See [IAM actions](iam-actions.md).

1. Navigate to the Claude Platform on AWS page in the [AWS Console](https://console.aws.amazon.com/).

1. Choose **Open Claude Console**. The AWS Console issues a JWT and redirects you to `platform.claude.com`.

1. On first sign-in, you’re prompted for an email address; enter your work email. The platform provisions your Claude Console user just-in-time.

Two Claude Console roles are available: **Admin** and **Developer**. The Admin role grants access to all Claude Console pages and settings available for Claude Platform on AWS. The Developer role grants read access to usage, cost, rate limit, and workspace information. Contact your Anthropic account representative to assign the Admin or Developer role to a principal.

## Available pages
<a name="_available_pages"></a>

The **Via AWS gateway** column indicates whether the page reads and writes data through the AWS gateway (and is therefore governed by [IAM actions](iam-actions.md)). Pages marked **No** read organization-level metadata directly through Anthropic APIs and bypass IAM action checks.


| Page | Available | Via AWS gateway | Notes | 
| --- | --- | --- | --- | 
|  **Usage**  | Yes | No | View token usage by model, workspace, and dimension. Data may take a few minutes to appear after a request. | 
|  **Cost**  | Yes | No | View cost breakdowns by model and workspace. AWS Cost Explorer shows the aggregated CCU line item. | 
|  **Limits**  | Yes | No | View rate limits (read-only). | 
|  **Workspaces**  | Yes | No | View per-region workspaces (read-only). | 
|  **Files**  | Yes | Yes | View and manage uploaded files. | 
|  **Skills**  | Yes | Yes | View and manage Agent Skills. | 
|  **Batches**  | Yes | Yes | View and manage batch processing jobs. | 
|  **Agents**  | Yes | Yes | View and manage agent definitions. | 
|  **Sessions**  | Yes | Yes | View agent sessions and event history. | 
|  **Environments**  | Yes | Yes | View and manage cloud container configurations for sessions. | 
|  **Credential vaults**  | Yes | Yes | View and manage credential vaults for session authentication. | 
|  **Memory stores**  | Yes | Yes | View and manage persistent agent memory. | 
|  **API keys**  | No | N/A | Manage API keys in the AWS Console (**Claude Platform on AWS → API keys**). See [Authentication](authentication.md). | 
|  **Members**  | No | N/A | Not applicable. AWS IAM manages access. | 
|  **Billing**  | No | N/A | Not applicable. AWS Marketplace manages billing and invoicing. View cost breakdowns on the Cost page. | 
|  **Claude Code**  | No | N/A | View Claude Code usage on the Usage page. | 

## Switching organizations
<a name="_switching_organizations"></a>

The Claude Console does not support organization switching for Claude Platform on AWS. To access a different organization, sign out and reauthenticate through the AWS Console using the IAM role for that organization’s AWS account.