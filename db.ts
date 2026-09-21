import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  Direction,
  LearningProgress,
  LocalList,
  LocalProfile,
  LocalVocabItem,
  SettingRecord,
} from "../domain/types";

export class SoleilDatabase extends Dexie {
  profile!: EntityTable<LocalProfile, "id">;
  lists!: EntityTable<LocalList, "id">;
  items!: EntityTable<LocalVocabItem, "id">;
  progress!: Table<LearningProgress, [string, Direction]>;
  settings!: EntityTable<SettingRecord, "key">;

  constructor(name = "soleil-vocab") {
    super(name);
    this.version(1).stores({
      profile: "&id",
      lists: "&id, source, active, updatedAt",
      items: "&id, listId, active",
      progress: "[itemId+direction], itemId, direction, lastReviewedAt",
      settings: "&key",
    });
  }
}
