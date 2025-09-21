import { Fragment } from "react";
import type { PropsWithChildren } from "react";

export const Provider = ({ children }: PropsWithChildren) => {
  return <Fragment>{children}</Fragment>;
};

export const CubidWidget = () => null;
