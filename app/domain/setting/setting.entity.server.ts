import { FirestoreDocumentUpdateError } from "~/lib/firestore-model/src/lib/firestore-errors.server";
import { BaseEntity } from "../base.entity";
import { OptionModel, type Setting } from "./setting.model.server";

export interface SettingEntityInterface extends BaseEntity<Setting> {
  findSettingsByContext(context: string): Promise<Setting[] | null>;
  findSettingsByContextAndName(
    context: string,
    name: string
  ): Promise<Setting | null>;
  updateOrCreate(
    record: Setting
  ): Promise<Setting | true | FirestoreDocumentUpdateError>;
}

class SettingEntity
  extends BaseEntity<Setting>
  implements SettingEntityInterface
{
  delete(
    record: Setting
  ): Promise<true | FirestoreDocumentUpdateError | Setting> {
    throw new Error("Method not implemented.");
  }
  deleteAll(): Promise<true | FirestoreDocumentUpdateError | Setting[]> {
    throw new Error("Method not implemented.");
  }
  override async create(record: Setting): Promise<Setting> {
    await this.validate(record);

    if (typeof record.value === "boolean") {
      record.value = record.value ? "true" : "false";
      record.type = "boolean";
    }

    if (Array.isArray(record.value)) {
      record.value = record.value.join(",");
      record.type = "array";
    }

    // if it is an object, we need to convert it to a string
    if (typeof record.value === "object") {
      record.value = JSON.stringify(record.value);
      record.type = "object";
    }

    record.type = record.type || "string";
    record.value = record.value || "";

    console.log(record);

    return await super.save(record);
  }

  /**
   * Get all the settings of a context passed as param
   *
   * @param context The context of option, like the module name
   * @param name The option name
   * @returns
   */
  async findSettingsByContext(context: string): Promise<Setting[] | null> {
    return await this.findAll([
      {
        field: "context",
        op: "==",
        value: context,
      },
    ]);
  }

  /**
   * Get the values of an option
   *
   * @param context The context of option, like the module name
   * @param name The option name
   * @returns
   */
  async findSettingsByContextAndName(
    context: string,
    name: string
  ): Promise<Setting | null> {
    return await this.findOne([
      {
        field: "context",
        op: "==",
        value: context,
      },
      {
        field: "name",
        op: "==",
        value: name,
      },
    ]);
  }

  async updateOrCreate(
    record: Setting
  ): Promise<Setting | true | FirestoreDocumentUpdateError> {
    const option = await this.findSettingsByContextAndName(
      record.context,
      record.name
    );

    if (option) {
      return await this.update(option.id!, record);
    }

    return await this.create(record);
  }
}

const settingEntity = new SettingEntity(OptionModel);

export { settingEntity };
