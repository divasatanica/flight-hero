import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";

expect.extend(matchers);
afterEach(cleanup);
// jsdom has no native modal implementation. Browser tests exercise the real dialog.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    // Native close events are queued. StrictMode can reopen the dialog first.
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  };
}
