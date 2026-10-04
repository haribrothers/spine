/**
 * US-OPS-24 (D-089) — money is shown only through `formatMoney`. Fails on
 * the patterns that used to hand-format it: importing `toDecimalString` to
 * display an amount, and a currency code pasted next to a value in a
 * template string (`${amount} ${currency}`) or JSX (`{amount} {currency}`).
 * A real need for a bare code (a currency picker, a CSV column) can say so
 * with an eslint-disable comment and a reason.
 */
const CURRENCY = "/^([a-zA-Z]+[cC]urrency|currency)$/";
const message = "Format money with formatMoney (D-089), not by joining an amount and a currency code.";

export default {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          { name: "@spine/shared/money", importNames: ["toDecimalString"], message },
          { name: "@spine/shared", importNames: ["toDecimalString"], message },
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      { selector: `TemplateLiteral > Identifier[name=${CURRENCY}]`, message },
      { selector: `TemplateLiteral > MemberExpression[property.name=${CURRENCY}]`, message },
      // Shown as text (a child), not passed as a prop.
      { selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer[expression.type='Identifier'][expression.name=${CURRENCY}]`, message },
      {
        selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer[expression.type='MemberExpression'][expression.property.name=${CURRENCY}]`,
        message,
      },
    ],
  },
};
