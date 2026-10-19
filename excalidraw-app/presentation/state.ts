import { atom } from "../app-jotai";

export type PresentationRequest = {
  /** whether the presenter overlay is open */
  active: boolean;
  /**
   * Slide to open on. `-1` starts from the slide currently in view (or the
   * first one when the viewport isn't over any slide).
   */
  startIndex: number;
};

export const presentationAtom = atom<PresentationRequest>({
  active: false,
  startIndex: -1,
});
