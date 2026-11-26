const imageByName = [
  [/tomato/, "tomatoes-320860_1280.jpg"], [/potato/, "potato.jpg"], [/onion/, "onion.jpg"],
  [/banana/, "banana.jpg"], [/mango/, "mango.jpg"], [/chilli|chili/, "chilli.jpg"],
  [/brown\s*rice/, "brown_rice.jpg"], [/(^|\s)rice/, "rice.jpg"], [/fertilizer.*organic|organic.*fertilizer/, "organicfertilizer.jpg"],
  [/npk|fertilizer/, "npk_fertilizer.jpg"], [/hoe/, "hoe.jpg"], [/axe/, "axe.jpg"], [/spade|shovel/, "spade.jpg"],
];
export function localProductImage(product) {
  if (product?.image && /^[A-Za-z0-9._-]+$/.test(product.image)) return `/images/${product.image}`;
  const match = imageByName.find(([pattern]) => pattern.test(String(product?.name || "").toLowerCase()));
  return `/images/${match?.[1] || "fallback.svg"}`;
}
