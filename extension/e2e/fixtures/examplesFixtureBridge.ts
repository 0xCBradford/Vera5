import type { Page } from "@playwright/test";

export const EXAMPLES_FIXTURE_BRIDGE_FLAG = "vera5ExamplesFixtureBridge" as const;

type ExamplesFixtureBridgeAction = "setStorage" | "scanPage";

export async function postExamplesFixtureBridgeMessage(
  page: Page,
  action: ExamplesFixtureBridgeAction,
  payload?: Record<string, unknown>
): Promise<void> {
  if (action === "setStorage") {
    await page.evaluate(
      async ({ bridgeFlag, bridgeAction, bridgePayload }) => {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Examples fixture storage seed timed out"));
          }, 15_000);

          const handler = (event: MessageEvent) => {
            if (event.source !== window) {
              return;
            }
            const data = event.data as {
              vera5ExamplesFixtureBridge?: boolean;
              action?: string;
            };
            if (
              data?.[bridgeFlag as "vera5ExamplesFixtureBridge"] &&
              data.action === "setStorageDone"
            ) {
              window.clearTimeout(timeout);
              window.removeEventListener("message", handler);
              resolve();
            }
          };

          window.addEventListener("message", handler);
          window.postMessage(
            {
              [bridgeFlag]: true,
              action: bridgeAction,
              payload: bridgePayload,
            },
            "*"
          );
        });
      },
      {
        bridgeFlag: EXAMPLES_FIXTURE_BRIDGE_FLAG,
        bridgeAction: action,
        bridgePayload: payload,
      }
    );
    return;
  }

  await page.evaluate(
    ({ bridgeFlag, bridgeAction }) => {
      window.postMessage(
        {
          [bridgeFlag]: true,
          action: bridgeAction,
        },
        "*"
      );
    },
    {
      bridgeFlag: EXAMPLES_FIXTURE_BRIDGE_FLAG,
      bridgeAction: action,
    }
  );
}
