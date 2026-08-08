import base from "@spine/config/eslint";

export default [
  // public/sw.js runs in the ServiceWorker global scope, not the browser/
  // node globals this config assumes — it's a static asset served as-is,
  // not app source, so it's excluded the same way build output already is.
  { ignores: ["public/**"] },
  ...base,
];
