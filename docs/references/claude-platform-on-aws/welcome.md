

# What is Claude Platform on AWS?
<a name="welcome"></a>

 *Access Claude’s full platform capabilities through AWS with Anthropic-managed infrastructure.* 

Claude Platform on AWS gives you the full Anthropic platform experience, including the Messages API, Agent Skills, code execution, and beta features, accessible through your AWS account. Unlike Amazon Bedrock, where AWS operates the inference stack, Anthropic operates Claude Platform on AWS. AWS provides the authentication layer (SigV4 or API key), IAM-based access control, and billing integration through AWS Marketplace.

**Note**  
The Anthropic SDKs support Claude Platform on AWS. For per-language client availability, see the [Anthropic Client SDKs documentation](https://platform.claude.com/docs/en/api/client-sdks).

## How the platform integration works
<a name="_how_the_platform_integration_works"></a>

Claude models run on Anthropic-managed infrastructure. This is a commercial integration for billing and access through AWS. Both Anthropic and AWS act as independent data processors. Use of Claude Platform on AWS is governed by the [AWS Service Terms](https://aws.amazon.com/service-terms/) and is subject to Anthropic’s Commercial Terms of Service, Data Processing Addendum, Usage Policy, and other agreements with Anthropic governing your use of their services.

Note the following operational characteristics. Data may not reside in AWS. Inference may route to Anthropic’s primary cloud. Subservices may change without notice. Set the `inference_geo` parameter per request to pin inference to a specific geography. See [Data residency](data-residency.md) for details.

Claude Platform on AWS follows the same data retention policy as the first-party Claude API. Zero Data Retention (ZDR) is available on request. Contact your Anthropic account representative to enable it for your account.

## Features of Claude Platform on AWS
<a name="_features_of_claude_platform_on_aws"></a>

Claude Platform on AWS provides the following capabilities:
+  **Same-day model and feature access** — New Claude models and API features are available the same day they launch on the first-party Claude API.
+  **Agent Skills** — Use pre-built Skills for document generation (PowerPoint, Excel, Word, PDF) and create custom Skills.
+  **Code execution** — Run code in Anthropic’s managed sandbox.
+  **Extended thinking** — Enable extended thinking for complex reasoning tasks.
+  **Streaming and batch processing** — Use real-time SSE streaming or submit batch requests for high-throughput workloads.
+  **Prompt caching** — Cache tools, system prompts, and message history to reduce latency and cost.
+  **Files API** — Upload and reference files across requests.
+  **AWS IAM integration** — Control access with standard IAM policies and SigV4 authentication.
+  **Unified AWS billing** — Pay through your existing AWS account with consumption-based metering (Marketplace as billing backend).

For the full list of supported features, see [Feature support](feature-support.md).

## How this guide is organized
<a name="_how_this_guide_is_organized"></a>

This guide covers the following topics:
+  **Getting started** — Account setup, prerequisites, authentication, and SDK installation.
+  **Using the API** — Available models, making requests, and feature support.
+  **Managing your environment** — Data residency, workspaces, the Claude Console, rate limits, and billing.
+  **Monitoring and operations** — CloudTrail logging and request ID tracking.
+  **Migration** — Moving from Amazon Bedrock to Claude Platform on AWS.
+  **Security and access control** — IAM policies and actions reference.