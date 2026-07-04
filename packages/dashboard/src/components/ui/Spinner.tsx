import React from "react";

export function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  return <div className={size === "lg" ? "spinner spinner-lg" : "spinner"} />;
}

export function LoadingState() {
  return (
    <div className="loading-state">
      <Spinner size="lg" />
    </div>
  );
}
