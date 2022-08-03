import { EntityUpdateChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { unsafeAssertType } from "@clientdb/server/utils/assert";
import { createLogger } from "@clientdb/server/utils/logger";
import { BadRequestError } from "../error";
import { createUpdateDeltaQuery } from "../query/delta/updateDelta";
import { Transaction } from "../query/types";
import { computeChanges } from "../utils/changes";
import { debug } from "../utils/log";
import { insertDeltaWithQuery } from "./delta";
import { getEntityIfAccessable } from "./entity";

const log = createLogger("Mutation");

function getEntityPointer(input: EntityUpdateChange<any, any>) {
  const entityName = input.entity as any as string;

  const pointer: EntityPointer = { entity: entityName, id: input.id };

  return pointer;
}

async function getAllowedEntityChanges<T, D>(
  tr: Transaction,
  context: SyncRequestContext<any>,
  input: EntityUpdateChange<T, D>
) {
  const pointer = getEntityPointer(input);

  const entityData = await getEntityIfAccessable<D>(
    tr,
    pointer,
    context,
    "update",
    true
  );

  if (!entityData) {
    throw new BadRequestError(`Entity ${input.entity} does not exist`);
  }

  console.log({ entityData });

  return computeChanges(entityData, input.data);
}

export async function performUpdate<T, D>(
  context: SyncRequestContext,
  input: EntityUpdateChange<T, D>
) {
  const { schema, db } = context;

  const entityName = input.entity as any as string;
  const idField = schema.getIdField(entityName)!;

  return await db.transaction(async (tr) => {
    unsafeAssertType<"update">(input.type);

    // Will throw if no access
    const changes = await getAllowedEntityChanges(tr, context, input);

    debug({ changes, input });

    if (!changes) {
      return;
    }

    const updateQuery = tr
      .table(entityName)
      .update(input.data)
      .where(`${entityName}.${idField}`, "=", input.id);

    const deltaQuery = createUpdateDeltaQuery(
      { entity: entityName, id: input.id, changes },
      context
    );

    console.log({ deltaQuery });

    if (deltaQuery) {
      await insertDeltaWithQuery(tr, deltaQuery);
    }

    log.debug(updateQuery.toString());

    const results = await updateQuery;

    if (results === 0) {
      throw new Error(`Not allowed to update ${entityName}`);
    }
  });
}
