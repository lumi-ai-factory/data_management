import { Link } from "@tanstack/react-router";
import * as React from "react";

/** Type-safe link to a content page: "" is the home route, anything else goes
 *  through the catch-all splat route. Avoids casting dynamic slugs to `any`. */
export function PageLink({
  slug,
  ...anchorProps
}: {
  slug: string;
} & Pick<
  React.ComponentPropsWithoutRef<"a">,
  "className" | "children" | "onClick" | "draggable" | "aria-current"
>) {
  return slug === "" ? (
    <Link to="/" {...anchorProps} />
  ) : (
    <Link to="/$/" params={{ _splat: slug }} {...anchorProps} />
  );
}
