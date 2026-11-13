// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { makeThread } from "@bb/test-helpers/domain-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadDeleteDialog } from "./ThreadDeleteDialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ThreadDeleteDialog", () => {
  it("identifies the selected thread, including its full title and ID", () => {
    const thread = makeThread({
      id: "thr_delete_target",
      title: "Investigate the sidebar confirmation dialog",
      titleFallback: "Original prompt",
    });

    render(
      <ThreadDeleteDialog
        target={{ threads: [thread] }}
        pending={false}
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const targets = screen.getByRole("list", { name: "Threads to delete" });
    expect(
      within(targets).getByText("Investigate the sidebar confirmation dialog"),
    ).toBeTruthy();
    expect(within(targets).getByText(thread.id)).toBeTruthy();
    expect(screen.queryByText("Original prompt")).toBeNull();
  });

  it("falls back to the prompt and identifies unnamed threads", () => {
    const threads = [
      makeThread({ id: "thr_prompt", title: null, titleFallback: "My prompt" }),
      makeThread({ id: "thr_untitled", title: " ", titleFallback: null }),
    ];

    render(
      <ThreadDeleteDialog
        target={{ threads }}
        pending={false}
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("My prompt")).toBeTruthy();
    expect(screen.getByText("Thread thr_unti")).toBeTruthy();
    for (const thread of threads) {
      expect(screen.getByText(thread.id)).toBeTruthy();
    }
  });

  it("distinguishes equal titles in a bulk selection and retains cascade warnings", () => {
    const threads = [
      makeThread({ id: "thr_first", title: "Same title" }),
      makeThread({ id: "thr_second", title: "Same title" }),
    ];
    const target = { threads, childThreadCount: 3 };
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ThreadDeleteDialog
        target={target}
        pending={false}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(within(item).getByText("Same title")).toBeTruthy();
    }
    for (const thread of threads) {
      expect(screen.getByText(thread.id)).toBeTruthy();
    }
    expect(screen.getByRole("dialog").textContent).toContain(
      "Their 3 child threads will be deleted too. This action cannot be undone.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete 2 threads" }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(target);
  });

  it("updates the displayed identity and confirmation together when the target changes", () => {
    const first = { threads: [makeThread({ title: "First thread" })] };
    const second = { threads: [makeThread({ title: "Second thread" })] };
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    const view = render(
      <ThreadDeleteDialog
        target={first}
        pending={false}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );

    view.rerender(
      <ThreadDeleteDialog
        target={second}
        pending={false}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByText("First thread")).toBeNull();
    expect(screen.getByText("Second thread")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete thread" }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(second);
  });

  it("keeps the identity visible while deletion is pending and prevents another confirmation", () => {
    const thread = makeThread({ title: "Pending deletion" });
    const onDelete = vi.fn();
    render(
      <ThreadDeleteDialog
        target={{ threads: [thread] }}
        pending
        onOpenChange={vi.fn()}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Pending deletion")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete thread" }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("keeps initial focus on Cancel and excludes target names from the announced warning", () => {
    const threads = Array.from({ length: 60 }, (_, index) =>
      makeThread({
        id: `thr_bulk_${index}`,
        title: `Selected thread ${index}`,
      }),
    );
    render(
      <ThreadDeleteDialog
        target={{ threads, childThreadCount: 3 }}
        pending={false}
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
    const dialog = screen.getByRole("dialog");
    const descriptionIds =
      dialog.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
    expect(descriptionIds.length).toBeGreaterThan(0);
    const description = descriptionIds
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(description).toContain(
      "Their 3 child threads will be deleted too. This action cannot be undone.",
    );
    expect(description).not.toContain("Selected thread");
    expect(description).not.toContain("thr_bulk_");
    expect(
      within(
        screen.getByRole("list", { name: "Threads to delete" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(60);
  });

  it("makes only an overflowing target list tabbable and keeps Cancel focused", () => {
    const measureCallbacks: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          measureCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    render(
      <ThreadDeleteDialog
        target={{ threads: [makeThread({ title: "A long target" })] }}
        pending={false}
        onOpenChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Scroll selected threads",
    });
    expect(region.tabIndex).toBe(-1);
    Object.defineProperties(region, {
      scrollHeight: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 192 },
    });
    act(() => measureCallbacks.forEach((measure) => measure()));
    expect(region.tabIndex).toBe(0);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );

    Object.defineProperty(region, "clientHeight", {
      configurable: true,
      value: 500,
    });
    act(() => measureCallbacks.forEach((measure) => measure()));
    expect(region.tabIndex).toBe(-1);
  });
});
