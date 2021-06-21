import invariant from "invariant";

const isDynamic = (segment) =>
  !!segment && segment.length > 1 && segment[0] === ":";

const stripSlashes = (str) => str.replace(/^\/+/g, "").replace(/\/+$/g, "");

const noop = () => {};

////////////////////////////////////////////////////////////////////////////////
// startsWith(string, search) - Check if `string` starts with `search`
const startsWith = (string, search) => {
  return string.substr(0, search.length) === search;
};

////////////////////////////////////////////////////////////////////////////////
// pick(routes, uri)
//
// Ranks and picks the best route to match. Each segment gets the highest
// amount of points, then the type of segment gets an additional amount of
// points where
//
//     static > dynamic > splat > root
//
// This way we don't have to worry about the order of our routes, let the
// computers do it.
//
// A route looks like this
//
//     { path, default, value }
//
// And a returned match looks like:
//
//     { route, params, uri }
//
// I know, I should use TypeScript not comments for these types.
const pick = (routes, uri) => {
  let match;
  let default_;

  let [uriPathname] = uri.split("?");
  let uriSegments = segmentize(uriPathname);
  let isRootUri = uriSegments[0] === "";
  let ranked = rankRoutes(routes);

  for (let i = 0, l = ranked.length; i < l; i++) {
    let missed = false;
    let route = ranked[i].route;

    if (route.default) {
      default_ = {
        route,
        params: {},
        uri,
      };
      continue;
    }

    const routeSegments = segmentize(route.path);
    const params = {};
    const max = Math.max(uriSegments.length, routeSegments.length);
    let index = 0;

    for (; index < max; index++) {
      let routeSegment = routeSegments[index];
      let uriSegment = uriSegments[index];

      if (isSplat(routeSegment)) {
        // Hit a splat, just grab the rest, and return a match
        // uri:   /files/documents/work
        // route: /files/*
        const param = routeSegment.slice(1) || "*";
        params[param] = uriSegments
          .slice(index)
          .map(decodeURIComponent)
          .join("/");
        break;
      }

      if (uriSegment === undefined) {
        // URI is shorter than the route, no match
        // uri:   /users
        // route: /users/:userId
        missed = true;
        break;
      }

      if (isDynamic(routeSegment) && !isRootUri) {
        const dynamicMatch = routeSegment.substr(1);
        const matchIsNotReserved = reservedNames.indexOf(dynamicMatch) === -1;
        invariant(
          matchIsNotReserved,
          `<Router> dynamic segment "${dynamicMatch[1]}" is a reserved name. Please use a different name in path "${route.path}".`
        );
        params[dynamicMatch] = decodeURIComponent(uriSegment);
      } else if (routeSegment !== uriSegment) {
        // Current segments don't match, not dynamic, not splat, so no match
        // uri:   /users/123/settings
        // route: /users/:id/profile
        missed = true;
        break;
      }
    }

    if (!missed) {
      match = {
        route,
        params,
        uri: "/" + uriSegments.slice(0, index).join("/"),
      };
      break;
    }
  }

  return match || default_ || null;
};

////////////////////////////////////////////////////////////////////////////////
// match(path, uri) - Matches just one path to a uri, also lol
let match = (path, uri) => pick([{ path }], uri);

////////////////////////////////////////////////////////////////////////////////
// resolve(to, basepath)
//
// Resolves URIs as though every path is a directory, no files.  Relative URIs
// in the browser can feel awkward because not only can you be "in a directory"
// you can be "at a file", too. For example
//
//     browserSpecResolve('foo', '/bar/') => /bar/foo
//     browserSpecResolve('foo', '/bar') => /foo
//
// But on the command line of a file system, it's not as complicated, you can't
// `cd` from a file, only directories.  This way, links have to know less about
// their current path. To go deeper you can do this:
//
//     <Link to="deeper"/>
//     // instead of
//     <Link to=`{${props.uri}/deeper}`/>
//
// Just like `cd`, if you want to go deeper from the command line, you do this:
//
//     cd deeper
//     # not
//     cd $(pwd)/deeper
//
// By treating every path as a directory, linking to relative paths should
// require less contextual information and (fingers crossed) be more intuitive.
const resolve = (to, base) => {
  // /foo/bar, /baz/qux => /foo/bar
  if (to[0] === "/") {
    return to;
  }

  let [toPathname, toQuery] = to.split("?");
  let [basePathname] = base.split("?");

  let toSegments = segmentize(toPathname);
  let baseSegments = segmentize(basePathname);

  // ?a=b, /users?b=c => /users?a=b
  if (toSegments[0] === "") {
    return addQuery(basePathname, toQuery);
  }

  // profile, /users/789 => /users/789/profile
  if (!startsWith(toSegments[0], ".")) {
    const pathname = baseSegments.concat(toSegments).join("/");
    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
  }

  // ./         /users/123  =>  /users/123
  // ../        /users/123  =>  /users
  // ../..      /users/123  =>  /
  // ../../one  /a/b/c/d    =>  /a/b/one
  // .././one   /a/b/c/d    =>  /a/b/c/one
  let allSegments = baseSegments.concat(toSegments);
  let segments = [];
  for (let i = 0, l = allSegments.length; i < l; i++) {
    let segment = allSegments[i];
    if (segment === "..") segments.pop();
    else if (segment !== ".") segments.push(segment);
  }

  return addQuery("/" + segments.join("/"), toQuery);
};

////////////////////////////////////////////////////////////////////////////////
// insertParams(path, params)

const insertParams = (path, params) => {
  const [pathBase, query = ""] = path.split("?");
  const segments = segmentize(pathBase);
  let constructedPath =
    "/" +
    segments
      .map((segment) =>
        isDynamic(segment) ? params[segment.substr(1)] : segment
      )
      .join("/");
  const { location: { search } = {} } = params;
  const searchSplit = (search && search.split("?")[1]) || "";
  return addQuery(constructedPath, query, searchSplit);
};

const validateRedirect = (from, to) =>
  segmentize(from).filter(isDynamic).sort().join("/") ===
  segmentize(to).filter(isDynamic).sort().join("/");

////////////////////////////////////////////////////////////////////////////////
// Junk
const SEGMENT_POINTS = 4;
const STATIC_POINTS = 3;
const DYNAMIC_POINTS = 2;
const SPLAT_PENALTY = 1;
const ROOT_POINTS = 1;

const isRootSegment = (segment) => segment === "";
const isSplat = (segment) => segment && segment[0] === "*";

const rankRoute = (route, index) => {
  let score = route.default
    ? 0
    : segmentize(route.path).reduce((score, segment) => {
        score += SEGMENT_POINTS;
        if (isRootSegment(segment)) score += ROOT_POINTS;
        else if (isDynamic(segment)) score += DYNAMIC_POINTS;
        else if (isSplat(segment)) score -= SEGMENT_POINTS + SPLAT_PENALTY;
        else score += STATIC_POINTS;
        return score;
      }, 0);
  return { route, score, index };
};

const rankRoutes = (routes) =>
  routes
    .map(rankRoute)
    .sort((a, b) =>
      a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
    );

const segmentize = (uri) => stripSlashes(uri).split("/");

const addQuery = (pathname, ...query) => {
  query = query.filter((q) => q && q.length > 0);
  return pathname + (query && query.length > 0 ? `?${query.join("&")}` : "");
};

const reservedNames = ["uri", "path"];

/**
 * Shallow compares two objects.
 * @param {Object} obj1 The first object to compare.
 * @param {Object} obj2 The second object to compare.
 */
const shallowCompare = (obj1, obj2) => {
  const obj1Keys = Object.keys(obj1);
  return (
    obj1Keys.length === Object.keys(obj2).length &&
    obj1Keys.every((key) => obj2.hasOwnProperty(key) && obj1[key] === obj2[key])
  );
};

////////////////////////////////////////////////////////////////////////////////
export {
  startsWith,
  stripSlashes,
  pick,
  match,
  noop,
  resolve,
  insertParams,
  validateRedirect,
  shallowCompare,
};
