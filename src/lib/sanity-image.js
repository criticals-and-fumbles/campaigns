/**
 * Minimal Sanity image CDN URL builder — hand-rolled instead of pulling in
 * `@sanity/image-url` to keep the bundle lean (this is pure deterministic
 * string construction, no need for a dependency). Project ID/dataset are
 * not secrets (same as the main site's NEXT_PUBLIC_SANITY_PROJECT_ID),
 * safe to bind once per request from env.
 */

let config = { projectId: "", dataset: "" };

export function configureSanityImage({ projectId, dataset }) {
  config = { projectId, dataset };
}

class ImageUrlBuilder {
  constructor(assetRef) {
    this.assetRef = assetRef;
    this.params = {};
  }
  width(w) {
    this.params.w = w;
    return this;
  }
  height(h) {
    this.params.h = h;
    return this;
  }
  url() {
    if (!this.assetRef) return null;
    // asset._ref format: image-<id>-<width>x<height>-<format>
    const match = /^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/.exec(this.assetRef);
    if (!match) return null;
    const [, id, dims, format] = match;
    const base = `https://cdn.sanity.io/images/${config.projectId}/${config.dataset}/${id}-${dims}.${format}`;
    const qs = new URLSearchParams({ auto: "format" });
    if (this.params.w) qs.set("w", this.params.w);
    if (this.params.h) qs.set("h", this.params.h);
    return `${base}?${qs.toString()}`;
  }
}

/** `image` is a Sanity image field value: { asset: { _ref: "image-..." } }. */
export function urlFor(image) {
  const ref = image?.asset?._ref;
  return new ImageUrlBuilder(ref);
}
