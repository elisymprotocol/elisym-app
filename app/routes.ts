import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/Home/Home.tsx"),
  route("profile", "routes/Profile/Profile.tsx"),
  route("terms", "routes/Terms/Terms.tsx"),
] satisfies RouteConfig;
