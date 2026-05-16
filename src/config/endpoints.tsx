export const initialAuthzRequest = JSON.stringify(
  {
    actor: {
      user_id: "user_external_alice",
      member_id: "member_finance_reviewer",
      binding_id: "binding_external_alice_finance",
      space_id: "space_acme",
      user_email: "alice@example.com",
      member_display_name: "Finance Reviewer",
    },
    resource: {
      type: "invoice",
      external_id: "invoice_001",
      space_id: "space_acme",
      group_path: "finance.apac",
      owner_member_id: "member_invoice_creator",
    },
    grants: [
      {
        role_key: "finance_approver",
        resource: "invoice",
        action: "approve",
        scope: "group_tree",
        space_id: "space_acme",
        scope_anchor_group_path: "finance",
      },
    ],
    action: "approve",
    explain: true,
  },
  null,
  2,
);
