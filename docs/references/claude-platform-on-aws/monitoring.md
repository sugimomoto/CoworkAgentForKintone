

# Monitoring and logging
<a name="monitoring"></a>

AWS CloudTrail can capture all requests to Claude Platform on AWS. Workspace and vault operations are logged as Management events by default. Inference, batch, file, skill, model, user profile, and Claude Managed Agents operations (other than vaults) are classified as Data events and require explicit data event logging configuration, which incurs additional CloudTrail charges. See [IAM actions](iam-actions.md) for the full event type classification and the [AWS CloudTrail documentation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/) for configuration details.

When configuring CloudTrail data event logging, select the resource type `AWS::AWSExternalAnthropic::Workspace`. This is the CloudTrail resource type for Claude Platform on AWS workspaces and is required to capture data plane events (inference, batch, file, and other per-workspace operations). Scope data event selectors to specific workspace ARNs if you want to log activity for a subset of workspaces rather than the whole account.

## Request IDs
<a name="_request_ids"></a>

Each response includes two request IDs in the response headers:
+  **AWS request ID (`x-amzn-requestid`):** The primary ID, indexed in CloudTrail. Use this when investigating requests through AWS tooling or when contacting AWS support.
+  **Anthropic request ID (`request-id`):** The secondary ID. Use this when contacting Anthropic support.

 **Python** 

```
from anthropic import AnthropicAWS

client = AnthropicAWS(aws_region="us-west-2")

response = client.messages.with_raw_response.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response.headers.get("x-amzn-requestid"))  # AWS request ID
print(response.headers.get("request-id"))  # Anthropic request ID

message = response.parse()
print(message.content)
```

 **TypeScript** 

```
import AnthropicAws from "@anthropic-ai/aws-sdk";

const client = new AnthropicAws({ awsRegion: "us-west-2" });

const { data: message, response } = await client.messages
  .create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello!" }]
  })
  .withResponse();

console.log(response.headers.get("x-amzn-requestid")); // AWS request ID
console.log(response.headers.get("request-id")); // Anthropic request ID
console.log(message.content);
```

 **C\#** 

```
using Anthropic;
using Anthropic.Aws;

var client = new AnthropicAwsClient(new() { AwsRegion = "us-west-2" });

var response = await client.WithRawResponse.Messages.Create(new()
{
    Model = "claude-sonnet-4-6",
    MaxTokens = 1024,
    Messages = [new() { Role = "user", Content = "Hello!" }]
});

Console.WriteLine(response.Headers.GetValues("x-amzn-requestid").First()); // AWS request ID
Console.WriteLine(response.Headers.GetValues("request-id").First()); // Anthropic request ID
Console.WriteLine(response.Value.Content);
```

 **Go** 

```
client, err := anthropicaws.NewClient(context.Background(), anthropicaws.ClientConfig{})
if err != nil {
    panic(err)
}

var response *http.Response
message, err := client.Messages.New(
    context.Background(),
    anthropic.MessageNewParams{
        Model:     anthropic.ModelClaudeSonnet4_6,
        MaxTokens: 1024,
        Messages: []anthropic.MessageParam{
            anthropic.NewUserMessage(anthropic.NewTextBlock("Hello!")),
        },
    },
    option.WithResponseInto(&response),
)
if err != nil {
    panic(err)
}

fmt.Println(response.Header.Get("x-amzn-requestid")) // AWS request ID
fmt.Println(response.Header.Get("request-id"))       // Anthropic request ID
fmt.Println(message.Content[0].Text)
```

 **Java** 

```
import com.anthropic.aws.backends.AwsBackend;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.http.HttpResponseFor;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;

AnthropicClient client = AnthropicOkHttpClient.builder()
    .backend(AwsBackend.fromEnv())
    .build();

HttpResponseFor<Message> response = client.messages().withRawResponse().create(
    MessageCreateParams.builder()
        .model(Model.CLAUDE_SONNET_4_6)
        .maxTokens(1024)
        .addUserMessage("Hello!")
        .build()
);

IO.println(response.headers().values("x-amzn-requestid")); // AWS request ID
IO.println(response.requestId()); // Anthropic request ID
IO.println(response.parse().content());
```

 **PHP** 

```
use Anthropic\Aws\Client;

$client = new Client();

$response = $client->messages->raw->create(
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    messages: [['role' => 'user', 'content' => 'Hello!']],
);

echo $response->getHeaderLine('x-amzn-requestid') . "\n"; // AWS request ID
echo $response->getHeaderLine('request-id') . "\n"; // Anthropic request ID
echo $response->parse();
```

 **Ruby** 

The Ruby SDK does not currently expose a raw-response accessor, so request IDs cannot be read from the response headers in Ruby. If you need request-ID logging, use any of the other languages above, or capture the IDs at the HTTP proxy layer.

Anthropic recommends logging your activity on at least a 30-day rolling basis to understand usage patterns and investigate any potential issues.

**Note**  
AWS CloudTrail is configured within your AWS account. Enabling logging does not provide AWS or Anthropic access to your content beyond what is necessary for billing and service operation.

## Usage metrics and dashboards
<a name="_usage_metrics_and_dashboards"></a>

Claude Platform on AWS does not publish per-workspace usage metrics to Amazon CloudWatch. Token counts, request volume, and per-model usage are instead available through Anthropic’s usage surfaces:
+  **Claude Console usage views** — when a principal federates into the Claude Console with `aws-external-anthropic:AssumeConsole` (see [IAM policies](iam-policies.md)), the usage dashboards show request volume, token counts, and per-model breakdowns for the workspaces the principal has access to. Account-wide usage views require admin console capability.
+  **Anthropic Usage and Cost API** — for programmatic access to usage and cost data, including per-workspace and per-model aggregation, see [Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) in the Anthropic documentation.

For operational monitoring (error rates, latency, rate limit headers), use the response headers returned on every request (see [Rate limits and quotas](rate-limits.md)) along with the AWS request IDs captured in CloudTrail.

## Cost allocation and monitoring
<a name="_cost_allocation_and_monitoring"></a>

Claude Platform on AWS charges appear on your AWS bill under the **Claude Platform on AWS** service, with per-model usage dimensions. Use the AWS Cost and Usage Report (CUR) combined with workspace tags for fine-grained cost allocation:

1. Tag your workspaces with the allocation dimensions you care about (team, application, environment, cost center). See [Workspaces](workspaces.md) for tagging details.

1. In the AWS Billing console, activate each tag key as a **cost allocation tag**. After activation, usage incurred on or after the activation date is split by tag in the CUR.

1. In CUR or AWS Cost Explorer, group by the `resourceTags/user:<tag-key>` column to break down spend by workspace tag.

Workspace tags flow through to CUR line items for all Claude Platform on AWS usage, so the same tag keys can drive both IAM-based access control and cost allocation without additional configuration. See [Cost allocation tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html) in the AWS Billing documentation for setup steps and activation delays.