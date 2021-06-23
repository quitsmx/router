const BABEL_ENV = process.env.BABEL_ENV;
const notCJS = BABEL_ENV !== undefined && BABEL_ENV !== "cjs";

const plugins = [
  "dev-expression",
  [
    "transform-inline-environment-variables",
    {
      include: ["COMPAT"],
    },
  ],
];

if (BABEL_ENV === "umd") {
  plugins.push("@babel/plugin-external-helpers");
}

module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        bugfixes: true,
        corejs: 3,
        modules: notCJS ? false : "commonjs",
        useBuiltIns: "entry",
      },
    ],
    [
      "@babel/preset-react",
      {
        development: false,
        runtime: "automatic",
        useBuiltIns: true,
        useSpread: true,
      },
    ],
  ],
  plugins: plugins,
};
