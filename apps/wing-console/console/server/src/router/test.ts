import { TestResult } from "@winglang/sdk/lib/std";
import { z } from "zod";

import { ConsoleLogger } from "../consoleLogger.js";
import { createProcedure, createRouter } from "../utils/createRouter.js";
import { ITestRunnerClient, Simulator } from "../wingsdk.js";

const getTestName = (testPath: string) => {
  const test = testPath.split("/").pop() ?? testPath;
  return test.replaceAll("test:", "");
};

const listTests = (simulator: Simulator): Promise<string[]> => {
  const testRunner = simulator.getResource(
    "root/cloud.TestRunner",
  ) as ITestRunnerClient;
  return testRunner.listTests();
};

const runTest = async (
  simulator: Simulator,
  resourcePath: string,
  logger: ConsoleLogger,
): Promise<InternalTestResult> => {
  logger.log("Reloading simulator...", "console", {
    messageType: "info",
  });
  await simulator.reload();

  const client = simulator.getResource(
    "root/cloud.TestRunner",
  ) as ITestRunnerClient;
  let result: InternalTestResult = {
    response: "",
    error: "",
    path: resourcePath,
    time: 0,
    pass: false,
    traces: [],
  };
  const startTime = Date.now();
  try {
    const t = await client.runTest(resourcePath);
    result = {
      ...result,
      ...t,
    };
    if (result.error) {
      throw new Error(result.error);
    }
    logger.log(
      `Test "${getTestName(resourcePath)}" succeeded (${
        Date.now() - startTime
      }ms)`,
      "console",
      {
        messageType: "success",
      },
    );
  } catch {
    logger.log(
      `Test "${getTestName(resourcePath)}" failed (${
        Date.now() - startTime
      }ms)`,
      "console",
      {
        messageType: "fail",
      },
    );
  }
  result.time = Date.now() - startTime;
  return result;
};

export interface InternalTestResult extends TestResult {
  response: string;
  time: number;
}

export const createTestRouter = () => {
  return createRouter({
    "test.list": createProcedure.query(async ({ input, ctx }) => {
      const simulator = await ctx.simulator();
      const list = await listTests(simulator);

      const testsState = ctx.testsStateManager();
      const tests = testsState.getTests();

      return list.map((resourcePath) => {
        const test = tests.find((t) => t.id === resourcePath);
        return {
          id: resourcePath,
          label: getTestName(resourcePath),
          status: test?.status ?? "pending",
          time: test?.time ?? 0,
        };
      });
    }),
    "test.run": createProcedure
      .input(
        z.object({
          resourcePath: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const response = await runTest(
          await ctx.simulator(),
          input.resourcePath,
          ctx.logger,
        );

        const testsState = ctx.testsStateManager();
        testsState.setTest({
          id: input.resourcePath,
          label: getTestName(input.resourcePath),
          status: response.error ? "error" : "success",
          time: response.time,
        });

        return response;
      }),
    "test.runAll": createProcedure.mutation(async ({ ctx }) => {
      const simulator = await ctx.simulator();
      const testsState = ctx.testsStateManager();

      const testList = await listTests(simulator);
      const result: InternalTestResult[] = [];
      for (const resourcePath of testList) {
        const response = await runTest(simulator, resourcePath, ctx.logger);
        result.push(response);
        testsState.setTest({
          id: resourcePath,
          label: getTestName(resourcePath),
          status: response.error ? "error" : "success",
          time: response.time,
        });
      }

      const testPassed = result.filter((r) => r.error === undefined);
      const time = result.reduce((accumulator, r) => accumulator + r.time, 0);

      const message = `Tests completed: ${testPassed.length}/${testList.length} passed. (${time}ms)`;
      ctx.logger.log(message, "console", {
        messageType: "summary",
      });

      return result;
    }),
  });
};
