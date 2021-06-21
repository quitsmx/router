const noop = () => {};

const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

const getLocation = (source) => {
  const { state } = source.history;
  const { search, hash, href, origin, protocol, host, hostname, port } =
    source.location;
  let { pathname } = source.location;

  if (!pathname && href && canUseDOM) {
    pathname = new URL(href).pathname;
  }

  pathname = pathname
    .split("/")
    .map((pathPart) => encodeURIComponent(decodeURIComponent(pathPart)))
    .join("/");

  return {
    pathname,
    search,
    hash,
    href,
    origin,
    protocol,
    host,
    hostname,
    port,
    state,
    key: (state && state.key) || "initial",
  };
};

const createHistory = (source) => {
  let listeners = [];
  let location = getLocation(source);
  let transitioning = false;
  let resolveTransition = noop;

  return {
    get location() {
      return location;
    },

    get transitioning() {
      return transitioning;
    },

    _onTransitionComplete() {
      transitioning = false;
      resolveTransition();
    },

    listen(listener) {
      listeners.push(listener);

      const popstateListener = () => {
        location = getLocation(source);
        listener({ location, action: "POP" });
      };

      source.addEventListener("popstate", popstateListener);

      return () => {
        source.removeEventListener("popstate", popstateListener);
        listeners = listeners.filter((fn) => fn !== listener);
      };
    },

    navigate(to, { state, replace = false } = {}) {
      if (typeof to === "number") {
        source.history.go(to);
      } else {
        state = { ...state, key: Date.now() + "" };
        // try...catch iOS Safari limits to 100 pushState calls
        try {
          if (transitioning || replace) {
            source.history.replaceState(state, null, to);
          } else {
            source.history.pushState(state, null, to);
          }
        } catch (e) {
          source.location[replace ? "replace" : "assign"](to);
        }
      }

      location = getLocation(source);
      transitioning = true;
      const transition = new Promise((res) => (resolveTransition = res));
      listeners.forEach((listener) => listener({ location, action: "PUSH" }));
      return transition;
    },
  };
};

////////////////////////////////////////////////////////////////////////////////
// Stores history entries in memory for testing or other platforms like Native
const createMemorySource = (initialPath = "/") => {
  const searchIndex = initialPath.indexOf("?");
  const initialLocation = {
    pathname:
      searchIndex > -1 ? initialPath.substr(0, searchIndex) : initialPath,
    search: searchIndex > -1 ? initialPath.substr(searchIndex) : "",
  };
  const stack = [initialLocation];
  const states = [null];
  let index = 0;

  return {
    get location() {
      return stack[index];
    },
    addEventListener: noop,
    removeEventListener: noop,
    history: {
      get entries() {
        return stack;
      },
      get index() {
        return index;
      },
      get state() {
        return states[index];
      },
      pushState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        index++;
        stack.push({ pathname, search: search.length ? `?${search}` : search });
        states.push(state);
      },
      replaceState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        stack[index] = { pathname, search };
        states[index] = state;
      },
      go(to = 0) {
        const newIndex = index + to;

        if (newIndex >= 0 && newIndex < states.length) {
          index = newIndex;
        }
      },
    },
  };
};

////////////////////////////////////////////////////////////////////////////////
// global history - uses window.history as the source if available, otherwise a
// memory history

const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
const { navigate } = globalHistory;

////////////////////////////////////////////////////////////////////////////////
export { globalHistory, navigate, createHistory, createMemorySource };
