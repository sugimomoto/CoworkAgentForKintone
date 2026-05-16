

# Feature support
<a name="feature-support"></a>

Claude Platform on AWS uses the Anthropic Messages API directly, which means you get full Messages API feature parity with the first-party Claude API (except where noted in [Features not currently available](#features-not-currently-available)):
+  **Beta features:** Pass the standard `anthropic-beta` header to access beta features, just as you would with the Claude API.
+  **Agent Skills:** Use pre-built and custom [Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) with the same `container.skills` parameter and beta headers as the Claude API. All pre-built Skills (PowerPoint, Excel, Word, PDF) work out of the box.
+  **Code execution:** Run code in Anthropic’s managed sandbox using the [code execution tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool).
+  **Tool use:** Computer use and all other [tool use capabilities](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) are available.
+  **Extended thinking:** Enable extended thinking with the same parameters as the Claude API.
+  **Streaming:** Full SSE streaming support for real-time responses.
+  **Batch processing:** Submit batch requests for high-throughput workloads.
+  **Prompt caching:** Cache tools, system prompts, and message history to reduce latency and cost. All prompt caching capabilities (5-minute TTL, 1-hour TTL, and automatic caching) are available.
+  **Files API:** Upload and reference files across requests.
+  **Workspace tags with IAM integration:** Workspaces can be tagged, and tags flow through to IAM for attribute-based access control and to AWS Cost and Usage Reports for cost allocation. Workspace tagging is a GA feature on Claude Platform on AWS (it is a beta feature on the first-party Claude API).

## Claude Managed Agents
<a name="_claude_managed_agents"></a>

Claude Managed Agents are available on Claude Platform on AWS. Agents, sessions, environments (cloud container configurations), credential vaults, and memory stores are first-class IAM resources; see [IAM actions](iam-actions.md) for the action reference and [Using the Claude Console](console.md) for the corresponding Claude Console pages. The Anthropic Agent SDK works against Claude Platform on AWS without a separate integration step — point it at the Claude Platform on AWS base URL and authenticate with SigV4 or an API key.

Autonomous sessions on Claude Platform on AWS require re-authentication every 6 hours. Long-running agent runs must refresh their SigV4 credentials or API key within that window, or the session ends.

The following Claude Managed Agents capabilities are not currently available on Claude Platform on AWS:
+  **Outcomes:** Outcome tracking for agent sessions is not available.
+  **Multi-agent sessions:** Sessions with multiple interacting agents are not available.
+  **Webhooks:** Webhook delivery of session events is not available.

## Compliance
<a name="_compliance"></a>

**Important**  
This service is a third-party offering provided by Anthropic and is not included within the scope of standard AWS compliance programs, certifications, or audit reports (such as SOC, ISO, or HIPAA eligibility). Customers are solely responsible for performing their own due diligence to ensure that this third-party offering meets their regulatory, legal, and compliance requirements. Before processing sensitive or regulated data, you should review Anthropic’s official compliance documentation via the [Anthropic Trust Center](https://trust.anthropic.com/). See the [AWS Service Terms](https://aws.amazon.com/service-terms/) for more information.

## How workspace membership is modeled
<a name="_how_workspace_membership_is_modeled"></a>

On the first-party Claude API, access is governed by users-to-workspaces membership — a user is added to a workspace and inherits the workspace’s access rights. Claude Platform on AWS replaces that model with IAM authorization: there is no per-workspace user list. Instead, IAM principals (users or roles) hold policies that grant `aws-external-anthropic` actions against specific workspace ARNs. The IAM policy evaluation determines what each principal can do in each workspace.

This means workspace access is granted and revoked by modifying IAM policies — through AWS Organizations SCPs, permission boundaries, identity-attached policies, or resource-level conditions — not by managing per-workspace membership in a Claude Console UI. See [IAM policies](iam-policies.md) for examples.

## Features not currently available
<a name="features-not-currently-available"></a>

The following capabilities are not currently available on Claude Platform on AWS:
+  **HIPAA readiness:** Anthropic’s HIPAA-ready program is not available on Claude Platform on AWS. Customers with HIPAA requirements should evaluate Claude in Amazon Bedrock instead.
+  **Service tiers beyond Standard and Batch:** Priority Tier is not available.
+  **Admin API — organization member, workspace member, invite, API key, usage report, cost report, and rate limit report endpoints:** These Admin API endpoints are not currently available. Workspace CRUD and rename endpoints (`/v1/organizations/workspaces`) are available through the `aws-external-anthropic` namespace; see [IAM actions](iam-actions.md). Membership is modeled through AWS IAM rather than through workspace membership lists (see preceding section). API key lifecycle is managed in the AWS Console under **Claude Platform on AWS → API keys**. For usage, cost, and rate limit data, use the Claude Console views (see [Monitoring and logging](monitoring.md)) or the Anthropic Usage and Cost API.
+  **Spend limits:** Not available. Rely on AWS billing controls instead.
+  **Claude Code workspace and Analytics API:** The Claude Code workspace with automatic rate limits is not available. Claude Code usage appears in the general usage view rather than a dedicated screen.
+  **OAuth authentication:** Not supported. Use SigV4 or API key authentication.
+  **OpenAI-compatible API endpoints:** Not available on Claude Platform on AWS.
+  **Workspace-level inference geography controls:** `allowed_inference_geos` and `default_inference_geo` are not available. Set `inference_geo` on each request instead.