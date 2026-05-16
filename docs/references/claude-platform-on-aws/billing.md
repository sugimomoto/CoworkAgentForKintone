

# Billing
<a name="billing"></a>

Claude Platform on AWS uses [AWS Marketplace](https://aws.amazon.com/marketplace) as a billing backend for consumption-based metering. Anthropic meters usage hourly through AWS Marketplace, and AWS issues monthly invoices on your existing AWS bill.

Billing is **arrears-only** (you pay for what you used) and **pre-tax** (AWS applies your account’s tax settings).

Usage is denominated in Claude Consumption Units (CCUs) at $0.01 USD per CCU. The CCU price is fixed and never discounted. Anthropic rates your token usage in USD at standard per-model, per-feature rates, applies any negotiated discount, then converts the result to CCUs at $0.01 per CCU. Discounts result in fewer CCUs metered, not a lower CCU price. CCUs are not prepaid credits; there is no CCU balance or commitment. See [Pricing](https://platform.claude.com/docs/en/about-claude/pricing#claude-platform-on-aws-pricing) for the CCU definition and per-model token rates.