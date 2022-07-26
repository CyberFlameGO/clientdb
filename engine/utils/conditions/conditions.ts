import { WhereValueConfig } from "../../schema/types";
import { ConditionGroupSegment } from "./segment";

export interface WhereTree {
  conditions: WherePointer[];
  and: WhereTree[];
  or: WhereTree[];
}

export interface WherePointer {
  select: string;
  config: WhereValueConfig<any>;
}

export interface RawWherePointer extends WherePointer {
  conditionPath: ConditionGroupSegment[];
}

function createWhereTree(): WhereTree {
  return { conditions: [], and: [], or: [] };
}

function getConditionTargetTree(pointer: RawWherePointer, root: WhereTree) {
  const { conditionPath } = pointer;

  if (!conditionPath.length) {
    return root;
  }

  let currentLeaf = root;

  for (const [segment, previousSegment] of iterateWithPrevious(conditionPath)) {
    if (typeof segment !== "number") continue;

    if (typeof previousSegment !== "string") {
      throw new Error("Invalid condition group");
    }

    if (previousSegment === "and") {
      currentLeaf = insertAtIndexIfDoesntExist(
        currentLeaf.and,
        segment,
        createWhereTree
      );
    }

    if (previousSegment === "or") {
      currentLeaf = insertAtIndexIfDoesntExist(
        currentLeaf.or,
        segment,
        createWhereTree
      );
    }
  }

  return currentLeaf;
}

function pushWherePointer(pointer: RawWherePointer, tree: WhereTree) {
  getConditionTargetTree(pointer, tree).conditions.push({
    select: pointer.select,
    config: pointer.config,
  });
}

export function parseWhereTree(pointers: RawWherePointer[]): WhereTree {
  const root = createWhereTree();

  for (const pointer of pointers) {
    pushWherePointer(pointer, root);
  }

  return root;
}

function iterateWithPrevious<T>(items: T[]) {
  const entries = items.map((item, index) => {
    return [item, items[index - 1] ?? null] as [T, T | null];
  });

  return entries;
}

function insertAtIndexIfDoesntExist<T>(
  items: T[],
  index: number,
  getter: () => T
) {
  if (items[index] !== undefined) return items[index]!;

  if (items.length <= index - 1) {
    items.length = index - 1;
  }

  const item = getter();

  items[index] = item;

  return item;
}