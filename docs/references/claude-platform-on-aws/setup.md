

# Set up your account
<a name="setup"></a>

Setting up Claude Platform on AWS happens in four phases: sign up on the AWS Console service page, complete your Anthropic organization setup, note your workspace ID, and sign in to the Claude Console.

**Note**  
Signing up through the AWS Console provisions a new Anthropic organization tied to your AWS account. This organization is separate from any existing organizations your company has with Anthropic, including Claude Enterprise organizations procured through AWS Marketplace. API keys, workspaces, and Claude Console settings from a first-party Anthropic organization don’t carry over.  
If you have an existing Amazon Bedrock private offer, contact your Anthropic or AWS account executive before signing up so your discount applies from your first request. Discounts cannot be applied retroactively to usage incurred before your private offer is accepted. See [Private offers](https://platform.claude.com/docs/en/about-claude/pricing#private-offers).

## Step 1: Sign up in the AWS Console
<a name="_step_1_sign_up_in_the_aws_console"></a>

1. Open the [AWS Console](https://console.aws.amazon.com/) and navigate to the **Claude Platform on AWS** service page.

1. Choose **Sign up**.

1. Choose **Continue**.

The page shows a **Sign-up in progress** banner. Stay on the page. Sign-up takes a few minutes while AWS handles the AWS Marketplace subscription for you, then redirects you automatically.

If your organization has a private offer from Anthropic, the Console looks it up and prompts you to accept it in AWS Marketplace. See [Private offers](https://platform.claude.com/docs/en/about-claude/pricing#private-offers) for details.

**Note**  
If you use Claude Platform on AWS, your content (such as prompts and completions) is processed by Anthropic outside of AWS. See Anthropic’s [data use policies](https://privacy.claude.com/en/articles/9264813-consumer-terms-of-service-updates) for details on how content and metadata are processed and stored.

## Step 2: Set up your Anthropic organization
<a name="_step_2_set_up_your_anthropic_organization"></a>

After sign-up completes, you’re redirected to `platform.claude.com/partner-signup`.

1. Enter the email address of your organization’s owner and choose **Get started**.

1. Check that email inbox for a setup link and follow it. If your browser shows a **Signed in as a different account** page, choose **Log out and continue**.

1. Complete the organization details form (organization name, entity type, country, intended use) and choose **Complete setup**.

Completing setup creates your Anthropic organization. Use of Claude Platform on AWS is governed by the [AWS Service Terms](https://aws.amazon.com/service-terms/) and is subject to Anthropic’s Commercial Terms of Service, Data Processing Addendum, Usage Policy, and other agreements with Anthropic governing your use of their services. The AWS Console service page now shows a left navigation with **Home**, **API keys**, **Quickstart**, and **Workspaces**.

## Step 3: Note your workspace ID
<a name="_step_3_note_your_workspace_id"></a>

A default workspace is provisioned automatically when you sign up. Additional workspaces can be created per region; see [Workspaces](workspaces.md) for details on region binding, workspace management, and IAM resource scoping.

Find the workspace ID under **Workspaces** on the AWS Console **Claude Platform on AWS** service page or in the Claude Console (see [Using the Claude Console](console.md)). Workspace IDs use the format `wrkspc_` followed by an alphanumeric identifier.

## Step 4: Sign in to the Claude Console
<a name="_step_4_sign_in_to_the_claude_console"></a>

Access to the Claude Console is federated through AWS IAM:

1. Assume an IAM role with the `aws-external-anthropic:AssumeConsole` permission. See [IAM actions](iam-actions.md).

1. From the **Claude Platform on AWS** service page, choose **Sign in**. The AWS Console issues a JWT and redirects you to `platform.claude.com`.

1. On first sign-in, you’re prompted for an email address. Enter your work email. The platform provisions your Claude Console user just-in-time.

When you’re signed in through the AWS Console, the Claude Console scopes to your Claude Platform on AWS organization. An **Account managed by AWS** indicator appears in the bottom-left of the Claude Console sidebar.

## Troubleshooting account setup
<a name="_troubleshooting_account_setup"></a>
+  **"Sign-up failed: Failed to enable OutboundWebIdentityFederation":** If you see this red banner on first submit, choose **Continue** again. The IAM enablement can take a moment to propagate.
+  **No progress indicator during sign-up:** Sign-up takes a few minutes. The page shows a static **Sign-up in progress** banner without a progress bar while AWS provisions your account.
+  **"Signed in as a different account" after following the setup link:** Choose **Log out and continue**. The page reauthenticates you with the email address you entered.
+  **"Not found" message during sign-in:** This message might appear briefly during redirect. You can dismiss it.
+  **Usage page shows no data after your first API call:** Usage data can take a few minutes to appear in the Claude Console.