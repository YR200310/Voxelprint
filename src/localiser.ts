// Minimal no-i18n localiser stub
// Keeps types simple and returns the given string/label as-is.

export type TLocalisedString = string;
export type TLocalisedKey = string;

export class Localiser {
    private static _instance: Localiser;
    public static get Get() {
        return this._instance || (this._instance = new this());
    }

    public async init() { /* no-op */ }
    public async changeLanguage(_languageKey: string) { /* no-op */ }
    public translate(p: string, _options?: any): TLocalisedString { return p; }
    public getCurrentLanguage() { return 'en-GB'; }
}

export const LOC = (p: string, _options?: any): TLocalisedString => Localiser.Get.translate(p);
