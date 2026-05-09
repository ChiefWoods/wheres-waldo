// eslint-disable-next-line import/no-anonymous-default-export
export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": (files) => [
    `oxlint --fix --no-error-on-unmatched-pattern ${files.join(" ")}`,
    `oxfmt --no-error-on-unmatched-pattern ${files.join(" ")}`,
  ],
};
