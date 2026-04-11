import { Injectable } from '@nestjs/common';
import { ITEM_CATALOG, type ItemCatalogEntry } from './item-catalog';

@Injectable()
export class ItemsService {
  private readonly itemCatalog = new Map<string, ItemCatalogEntry>(
    Object.values(ITEM_CATALOG).map((entry) => [entry.code, entry]),
  );

  async findByCodes(codes: string[]) {
    return [...new Set(codes)]
      .map((code) => this.itemCatalog.get(code))
      .filter((entry): entry is ItemCatalogEntry => Boolean(entry));
  }

  async findByCode(code: string) {
    return this.itemCatalog.get(code) ?? null;
  }
}
