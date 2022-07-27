import { DbSchemaModel } from "../../../schema/model";
import { PermissionRule } from "../../../schema/types";
import {
  RawWherePointer,
  parseWhereTree,
} from "../../../utils/conditions/conditions";
import { mapPermissions } from "../../permissions/traverse";

export function createPermissionWhereConditions<T>(
  entity: string,
  permissions: PermissionRule<T>,
  schema: DbSchemaModel
) {
  const wherePointers = mapPermissions(entity, permissions, schema, {
    onValue({ schemaPath, value, conditionPath, field, table }) {
      const pointer: RawWherePointer = {
        table: table,
        conditionPath: conditionPath,
        condition: value,
        select: `${schemaPath.join("__")}.${field}`,
      };

      return pointer;
    },
  });

  return parseWhereTree(wherePointers);
}
