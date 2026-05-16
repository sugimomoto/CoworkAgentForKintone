

# Authentication
<a name="authentication"></a>

Claude Platform on AWS supports two authentication methods: AWS IAM with SigV4 request signing (primary) and API key authentication. Both use the same base URL and request format.

The Anthropic SDKs (see [Install an SDK](install-sdk.md)) implement the authentication flow and credential resolution described below. If you aren’t using an Anthropic SDK, you must construct SigV4-signed requests (or present your API key as a bearer token) against the regional endpoint `https://aws-external-anthropic.<region>.api.aws`. For SDK-specific client configuration and the authoritative credential-resolution order, see the [Claude on AWS setup guide](https://platform.claude.com/docs/en/api/claude-on-aws) in the Anthropic documentation.

## SigV4 authentication
<a name="_sigv4_authentication"></a>

SigV4 is the enterprise-native path and integrates with your existing AWS IAM policies, roles, and auditing. Configure AWS credentials using any method supported by the [AWS default credential provider chain](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html):
+ Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`)
+ Shared credentials file (`~/.aws/credentials`)
+ Shared config file (`~/.aws/config`) including SSO and `credential_process` 
+ Web identity (`AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN`) for IRSA and GitHub Actions
+ ECS container credentials
+ EC2 instance metadata service (IMDS)

To verify the Anthropic SDK is picking up your credentials and resolving to the correct regional endpoint, make a test request following the examples in [Making requests](making-requests.md). A successful response confirms that credentials, region, base URL, and workspace ID are all correctly configured.

## API key authentication
<a name="_api_key_authentication"></a>

For simpler integration paths (local development and scripts), you can authenticate with an API key instead of SigV4. Set the `ANTHROPIC_AWS_API_KEY` environment variable or pass `apiKey` to the SDK constructor. The Anthropic SDK sends the key as a bearer token to the Claude Platform on AWS endpoint; IAM authorizes the request through the `aws-external-anthropic:CallWithBearerToken` action (see [IAM policies](iam-policies.md)).

Generate API keys in the **AWS Console** under **Claude Platform on AWS → API keys**. Choose **Generate a key**, then copy the key value. Grant the `aws-external-anthropic:CallWithBearerToken` IAM action to the principals that should be allowed to use API key authentication.

**Note**  
Only API keys created in the AWS Console under **Claude Platform on AWS** work with this service.  
Keys created in the standard [Claude Console](https://platform.claude.com/) for first-party API access do not work against the Claude Platform on AWS endpoint.
Amazon Bedrock API keys do not work either — Bedrock uses a separate endpoint, authentication flow, and IAM namespace.

## Short-term API keys
<a name="_short_term_api_keys"></a>

For cases where you want API key authentication but without the lifetime of a long-lived key, Anthropic publishes token-generator libraries that mint short-term API keys from your AWS IAM credentials. Tokens default to a 12-hour lifetime and can be scoped to a specific workspace and to the `aws-external-anthropic:CallWithBearerToken` action. Install the generator that matches your language, then exchange IAM credentials for an API key and pass the result to the Anthropic SDK the same way you would a long-lived key.
+  **Python:** [aws/token-generator-for-aws-external-anthropic-python](https://github.com/aws/token-generator-for-aws-external-anthropic-python) 
+  **JavaScript / TypeScript:** [aws/token-generator-for-aws-external-anthropic-js](https://github.com/aws/token-generator-for-aws-external-anthropic-js) 
+  **Java:** [aws/token-generator-for-aws-external-anthropic-java](https://github.com/aws/token-generator-for-aws-external-anthropic-java) 

Short-term API keys still require the caller’s IAM principal to hold `aws-external-anthropic:CallWithBearerToken` on the target workspace. They expire on their own and do not need to be rotated or revoked explicitly.

## Credential precedence and region resolution
<a name="_credential_precedence_and_region_resolution"></a>

The Anthropic SDK’s Claude Platform on AWS client resolves credentials and region using a defined precedence order. Argument names vary by language convention (TypeScript and PHP use camelCase; Python and Ruby use snake\_case; Go uses Pascal case with capitalized acronyms; C\# and Java use the language’s property or builder idioms).

For the authoritative precedence order, supported environment variables, and constructor arguments for each SDK, see [Claude on AWS setup](https://platform.claude.com/docs/en/api/claude-on-aws) in the Anthropic documentation. In general, explicit constructor arguments take precedence over environment variables, and `ANTHROPIC_AWS_API_KEY` takes precedence over the default AWS credential provider chain. Region is required; unlike `AnthropicBedrock` (which falls back to `us-east-1`), the Claude on AWS client throws if no region is supplied by the constructor or by `AWS_REGION` / `AWS_DEFAULT_REGION`.

## Workspace ID
<a name="_workspace_id"></a>

Every data plane request must include the workspace ID in the `anthropic-workspace-id` header. The Anthropic SDKs read this from the `ANTHROPIC_AWS_WORKSPACE_ID` environment variable by default, or you can pass `workspaceId` / `workspace_id` to the client constructor. If you use the base `Anthropic` client (not the Claude-on-AWS client), pass the header explicitly. See [Making requests](making-requests.md) for per-language examples and [Workspaces](workspaces.md) for how to locate your workspace ID.