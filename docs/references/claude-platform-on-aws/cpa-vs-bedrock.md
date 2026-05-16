

# Claude Platform on AWS vs Amazon Bedrock
<a name="cpa-vs-bedrock"></a>

Both offerings let you use Claude through AWS, but they differ significantly in architecture, API surface, and feature availability.


|  | Claude Platform on AWS | Amazon Bedrock | 
| --- | --- | --- | 
|  **Who operates the stack**  | Anthropic | AWS | 
|  **API surface**  | Anthropic Messages API (`/v1/messages`) | Bedrock API (Converse / InvokeModel) | 
|  **Feature availability**  | Same-day as Claude API | Depends on AWS integration timeline | 
|  **Agent Skills**  | Available | Not available (requires code execution) | 
|  **Beta features**  | Pass through with `anthropic-beta` headers (see [Feature support](feature-support.md)) | Requires AWS support | 
|  **Authentication**  | AWS IAM / SigV4 or API key | AWS IAM / SigV4 or bearer token (C\#, Go, and Java SDKs only) | 
|  **Base URL**  |  `aws-external-anthropic.{region}.api.aws`  |  `bedrock-runtime.{region}.amazonaws.com`  | 
|  **SDK client**  | Platform-specific client class (for example, `AnthropicAWS` in Python), in beta |  `AnthropicBedrock` / Bedrock SDK | 
|  **Console**  | Claude Console (`platform.claude.com`, access through the AWS Console) | Bedrock Console | 
|  **Rate limits and quotas**  | Managed by Anthropic | Managed by AWS | 
|  **Data processors**  | Anthropic and AWS | AWS | 

If you need AWS-operated Claude with the Bedrock API, see [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/).

**Important**  
Claude Platform on AWS is a third-party offering provided by Anthropic and is not included within the scope of standard AWS compliance programs, certifications, or audit reports (such as SOC, ISO, or HIPAA eligibility). Customers are solely responsible for performing their own due diligence to ensure that this third-party offering meets their regulatory, legal, and compliance requirements.

 **When to choose Bedrock:** Choose Amazon Bedrock if your organization requires AWS to operate the inference stack, requires AWS to be the sole data processor, or requires coverage under AWS compliance programs, certifications, or audit reports (including FedRAMP High, IL4, IL5, SOC, ISO, and HIPAA eligibility). Bedrock runs entirely on AWS-controlled infrastructure with AWS as the operating party.