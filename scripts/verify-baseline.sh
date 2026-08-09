#!/usr/bin/env bash
# Verifies that the migration files, TAKEN TOGETHER, describe our full schema.
# Reads every file in supabase/migrations/ — not just the newest one.

if ! ls supabase/migrations/*.sql >/dev/null 2>&1; then
  echo "No migration files found. Run 'supabase db pull' first."
  exit 1
fi

echo "Checking these files:"
ls -1 supabase/migrations/*.sql | sed 's/^/  /'
echo

ALL=$(cat supabase/migrations/*.sql)
FAILS=0

check() {                      # check <label> <regex>
  if grep -qiE "$2" <<< "$ALL"; then
    printf "  OK    %s\n" "$1"
  else
    printf "  MISS  %s\n" "$1"
    FAILS=$((FAILS + 1))
  fi
}

echo "--- TABLES ---"
for t in universities users products product_likes product_saves posts \
         messages comments comment_votes purchases courses specializations \
         visitor_metrics; do
  check "$t" "create table.*[\"\.]${t}[\"[:space:](]"
done

echo
echo "--- FUNCTIONS / RPCs ---"
for f in increment_page_view increment_product_views \
         update_product_likes_count update_product_comments_count \
         toggle_comment_vote update_comment_vote_counts \
         get_user_inbox cleanup_demo_users; do
  check "$f" "function.*[\"\.]${f}[\"[:space:](]"
done

echo
echo "--- TRIGGERS ---"
for tg in trg_update_likes_count trg_update_comment_votes trg_update_comments_count; do
  check "$tg" "trigger.*${tg}"
done

echo
echo "--- STORAGE ---"
check "storage policies" "storage\.objects"

echo
if [ "$FAILS" -eq 0 ]; then
  echo "✅ Baseline complete — all objects present across your migrations."
else
  echo "❌ $FAILS object(s) missing. Do NOT proceed."
  echo "   Re-run 'supabase db pull', or add the missing objects as a new migration."
fi
exit "$FAILS"