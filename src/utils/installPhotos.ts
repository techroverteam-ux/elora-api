// Installation photos per board. The mobile app uploads up to three per board
// (before, after, closeup). Older records have no photoType: for those, the upload
// order was before, after, closeup when there are several, or a single installed photo.

export type InstallPhotoType = "before" | "after" | "closeup";
export const INSTALL_PHOTO_TYPES: InstallPhotoType[] = ["before", "after", "closeup"];

type Entry = { reccePhotoIndex: number; installationPhoto: string; photoType?: string };

/** Photos of one board keyed by type. */
export const installPhotosByType = (photos: Entry[] | undefined, boardIndex: number): Partial<Record<InstallPhotoType, Entry>> => {
  const list = (photos || []).filter((p) => p && p.reccePhotoIndex === boardIndex);
  const out: Partial<Record<InstallPhotoType, Entry>> = {};
  const untyped: Entry[] = [];
  list.forEach((p) => {
    if (p.photoType && (INSTALL_PHOTO_TYPES as string[]).includes(p.photoType)) out[p.photoType as InstallPhotoType] = p;
    else untyped.push(p);
  });
  if (untyped.length === 1 && !out.after) out.after = untyped[0];
  else
    untyped.forEach((p, i) => {
      const t = INSTALL_PHOTO_TYPES[i];
      if (t && !out[t]) out[t] = p;
    });
  return out;
};

/** The photo that shows the finished board: after, else close-up, else whatever exists. */
export const pickInstalledPhoto = (photos: Entry[] | undefined, boardIndex: number): Entry | undefined => {
  const t = installPhotosByType(photos, boardIndex);
  return t.after || t.closeup || t.before;
};
