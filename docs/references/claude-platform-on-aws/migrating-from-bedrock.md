

# Migrating from Amazon Bedrock
<a name="migrating-from-bedrock"></a>

If you currently use Claude on Bedrock, migrating to Claude Platform on AWS requires changes throughout your integration. SigV4 signing remains supported, but the signing context, base URL, API format, model IDs, SDK client and package, streaming format, request headers, and region availability all change. The following table summarizes the differences.

## What changes
<a name="_what_changes"></a>


|  | Amazon Bedrock | Claude Platform on AWS | 
| --- | --- | --- | 
|  **Base URL**  |  `bedrock-runtime.{region}.amazonaws.com`  |  `aws-external-anthropic.{region}.api.aws`  | 
|  **API format**  | Bedrock Converse / InvokeModel | Anthropic Messages API (`/v1/messages`) | 
|  **Model IDs**  |  `anthropic.claude-opus-4-7-v1`  |  `claude-opus-4-7`  | 
|  **SDK client**  |  `AnthropicBedrock` / Bedrock SDK | Platform-specific client (`AnthropicAWS`, `AnthropicAws`, `AnthropicAwsClient`, etc.), in beta | 
|  **SDK package**  |  `anthropic[bedrock]`, `@anthropic-ai/bedrock-sdk`, etc. |  `anthropic[aws]`, `@anthropic-ai/aws-sdk`, etc. (see [Install an SDK](install-sdk.md)) | 
|  **SigV4 service name**  |  `bedrock`  |  `aws-external-anthropic`  | 
|  **Streaming format**  | AWS EventStream | SSE (same as Claude API) | 
|  **Workspace header**  | Not applicable |  `anthropic-workspace-id` required | 
|  **Region availability**  | Multiple commercial regions | All AWS commercial regions (opt-in regions require account opt-in) | 

## What you gain
<a name="_what_you_gain"></a>
+ Typically same-day access to new models and features, without a separate partner integration step
+ Agent Skills for document generation (PowerPoint, Excel, Word, PDF)
+ Code execution in Anthropic’s managed sandbox
+ Beta features through the `anthropic-beta` header (see [Features not currently available](feature-support.md#features-not-currently-available))
+ Claude Console for quota visibility and usage analytics
+ Direct Anthropic support
+ API key authentication as an alternative to SigV4 (see [Authentication](authentication.md))

## What stays the same
<a name="_what_stays_the_same"></a>
+ AWS IAM authentication (SigV4)
+ Billing through your AWS account
+ AWS commitment retirement

## Migration pitfalls
<a name="_migration_pitfalls"></a>

**Warning**  
 **Enable outbound web identity federation first.** If your AWS account has not previously used Claude Platform on AWS, you must [enable outbound web identity federation](prerequisites.md#enable-outbound-web-identity-federation) once per account before making requests. Without this step, all requests fail with a federation error. This step is not required for Bedrock.

**Warning**  
 **Zero Data Retention (ZDR) is opt-in on Claude Platform on AWS.** On Bedrock, AWS is the data processor and Anthropic does not retain inference inputs or outputs; Anthropic’s ZDR program does not apply there. On Claude Platform on AWS, Anthropic is the data processor, and ZDR follows the first-party Claude API model: it is available on request through your Anthropic account representative. Confirm ZDR enrollment before migrating production workloads that depend on data-retention guarantees.

## Commercial considerations
<a name="_commercial_considerations"></a>
+  **Terms of service:** Use of Claude Platform on AWS is governed by the [AWS Service Terms](https://aws.amazon.com/service-terms/) and is subject to Anthropic’s Commercial Terms of Service, Data Processing Addendum, Usage Policy, and other agreements with Anthropic governing your use of their services.
+  **Discounts and private offers:** Negotiated discounts and AWS Marketplace private offers don’t transfer automatically between Bedrock and Claude Platform on AWS. Work with your Anthropic account representative to set up commercial terms for Claude Platform on AWS.