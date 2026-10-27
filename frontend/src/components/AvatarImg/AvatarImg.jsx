// frontend/src/components/AvatarImg/AvatarImg.jsx
//
// A round avatar: the photo, or — with no photo, or one that fails to load —
// the person's initials on a gradient picked from their name, so the same
// person always gets the same colour. Moved out of Messages.jsx (Block N-H) so
// the buyer picker draws people the same way the chat does.
//
// Every avatar on the site wears the same thin purple ring, photo or initials
// (owner, 27 Oct): 1.5px, or 2px from 40px up — the inbox's and the product
// card's ring. It is inline, so it holds whatever class the caller passes.
import React, { useState } from "react";

export const avatarRing = (size) =>
  `${size >= 40 ? 2 : 1.5}px solid var(--purple-emphasis)`;

export default function AvatarImg({ src, name, size = 40, className }) {
  const [err, setErr] = useState(false);
  const displayName = name || "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hue =
    displayName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (!src || err) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          background: `linear-gradient(135deg, hsl(${hue},55%,50%), hsl(${hue + 40},55%,40%))`,
          color: "#fff",
          fontWeight: 700,
          fontSize: size * 0.36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
          border: avatarRing(size),
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={className}
      style={{ border: avatarRing(size) }}
      onError={() => setErr(true)}
    />
  );
}
