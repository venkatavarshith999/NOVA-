import { Component, type ReactNode } from "react";
import { ServerError } from "../pages/ErrorPages";

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Nova AI runtime error:", error);
  }

  render() {
    if (this.state.hasError) return <ServerError />;
    return this.props.children;
  }
}
