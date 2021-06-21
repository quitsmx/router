const BABEL_ENV = process.env.BABEL_ENV;
const building = BABEL_ENV !== undefined && BABEL_ENV !== "cjs";

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
        corejs: 3,
        loose: true,
        modules: building ? false : "commonjs",
        useBuiltIns: "entry",
      },
    ],
    "@babel/preset-react",
  ],
  plugins: plugins,
};
