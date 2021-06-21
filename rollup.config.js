import babel from "@rollup/plugin-babel";
import replace from "@rollup/plugin-replace";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";

const NODE_ENV =
  process.env.NODE_ENV === "production" ? "production" : "development";

const config = {
  input: "src/index.js",
  output: {
    name: "ReachRouter",
    preferConst: true,
    globals: {
      react: "React",
      "react-dom": "ReactDOM",
    },
  },
  external: ["react", "react-dom"],
  plugins: [
    babel({
      babelHelpers: "external",
      exclude: "node_modules/**",
    }),
    resolve(),
    commonjs({
      include: /node_modules/,
    }),
    replace({
      "process.env.NODE_ENV": JSON.stringify(NODE_ENV),
      preventAssignment: true,
    }),
  ],
};

if (NODE_ENV === "production") {
  config.plugins.push(
    terser({
      ecma: 2018,
      module: true,
      compress: {
        dead_code: true,
        global_defs: {
          process: { env: { NODE_ENV } },
        },
      },
    })
  );
}

export default config;
