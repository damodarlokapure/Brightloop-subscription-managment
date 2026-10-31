# Brightloop 5-Minute Demo Walkthrough

This walkthrough uses the seeded demo data to show the core Brightloop story in under five minutes: customer signup, plan selection, quote-to-subscription conversion, billing, payments, discounts, and finance reporting.

## Demo credentials

- Admin: `admin@brightloop.demo` / `Demo@12345`
- Staff: `staff1@brightloop.demo` / `Demo@12345`
- Customer: `customer01@brightloop.demo` / `Demo@12345`

## Scenario

The company is using Brightloop to manage several subscriptions across product lines. Some customers are on a Growth or Scale plan, one or two are in overdue collections, and the finance dashboard should show healthy revenue with an overdue tail.

## Minute 1: Open the admin view

1. Log in as `admin@brightloop.demo`.
2. Open the Admin Dashboard.
3. Confirm the summary cards show revenue, subscriptions, invoices, and overdue metrics.
4. Browse the product catalog and plan catalog to validate the active product mix.
5. Check the Discounts page to see product and subscription-level offers, including expired and exhausted discounts.

What this demonstrates:
- Admin-only controls
- Product and plan lifecycle visibility
- Discounts management and rule enforcement

## Minute 2: Staff operations and quote flow

1. Log out of the admin role and log in as `staff1@brightloop.demo`.
2. Open Customers and choose a customer such as `Customer 5`.
3. Open the customer detail page and create or review a quotation.
4. Apply the `Launch Foundation` or `Scale Enterprise` template.
5. Convert the quotation into a subscription and confirm the status update from QUOTATION to CONFIRMED to ACTIVE.

What this demonstrates:
- Staff can work with customers, quotations, and subscriptions
- Brightloop enforces lifecycle status progression
- Templates make onboarding faster and more consistent

## Minute 3: Billing run and invoice generation

1. Go to Subscriptions and open a newly active subscription.
2. Review the subscription lines and billing periods.
3. Open the invoice list and locate the current recurring invoice for the selected customer.
4. Confirm the invoice is in `CONFIRMED` or `PAID` status and includes the correct totals, tax, and dates.
5. Review the generated account activity and due dates.

What this demonstrates:
- Idempotent recurring invoice generation
- Subscription line amounts are accurate
- Billing dates align with the subscription period

## Minute 4: Discounts and collections

1. Open a customer with a configured subscription and review the discount eligibility panel.
2. Verify that the older `ERP percentage offer` or `Growth annual fixed credit` is visible on the invoice or customer grant view.
3. Open the Overdue or Collections view.
4. Select one of the overdue invoice records and confirm it is beyond the due date with no payment posted yet.
5. Mark or review the payment intake flow.

What this demonstrates:
- Discount rules apply to the next invoice only or to eligible subscriptions
- The collection process is visible without leaking other customers' data
- Finance is able to track overdue accounts

## Minute 5: Customer portal and finance report

1. Log in as `customer01@brightloop.demo`.
2. Review the portal dashboard and confirm only this customer's subscriptions and invoices appear.
3. Open the portal invoice list and check the customer can view their own invoice history and payment activity.
4. Log back in as `staff1@brightloop.demo` or `admin@brightloop.demo`.
5. Open the Finance Dashboard and review totals, charts, payment mix, and overdue trend.
6. Use the filters to narrow by invoice status or period and confirm that the report responds quickly.

What this demonstrates:
- Customer portal access is properly scoped
- Finance dashboard aggregates the real revenue picture
- All views work with the seeded data set and match business expectations

## Suggested narrative for the live demo

“Brightloop brings together product catalog management, subscription lifecycle, recurring billing, discounts, collections, and customer self-service in a single operating system.”

Use the seeded demo to tell the story from a sales motion to an operational billing cycle to a finance review, closing with the customer portal that gives customers transparency without exposing internal admin controls.
