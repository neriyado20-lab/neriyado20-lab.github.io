# הפעלת מיילים אוטומטיים לגל עיני

המנגנון באתר כבר מוכן לשימוש עם Supabase Edge Function בשם `send-notification` ועם Resend לשליחת מיילים.

## מה צריך לעשות פעם אחת

1. לפתוח חשבון ב-Resend: https://resend.com
2. ליצור API Key ב-Resend.
3. ב-Supabase לפתוח את הפרויקט `sxbfjouuguniegwbevwy`.
4. להיכנס אל Edge Functions > Secrets.
5. להוסיף סודות:

```text
RESEND_API_KEY=המפתח שקיבלת מ-Resend
MAIL_FROM=Gal Einai <onboarding@resend.dev>
MAIL_REPORT_TO=כתובת המייל שלך לקבלת עותק/דיווח
```

אפשר בהמשך להחליף את `MAIL_FROM` לכתובת בדומיין שלך, למשל:

```text
MAIL_FROM=Gal Einai <updates@your-domain.example>
```

בשביל כתובת בדומיין שלך צריך לאמת את הדומיין ב-Resend.

## פרסום הפונקציה

צריך לפרסם ל-Supabase את הקובץ:

```text
supabase/functions/send-notification/index.ts
```

אפשר לעשות זאת דרך Supabase Dashboard > Edge Functions > Create/Deploy Function בשם:

```text
send-notification
```

או דרך Supabase CLI אם הוא מותקן ומחובר:

```powershell
supabase functions deploy send-notification --project-ref sxbfjouuguniegwbevwy
```

## שימוש באתר

1. נכנסים לאוצר הצפנים.
2. נכנסים לממשק הניהול.
3. פותחים `רשימות עדכון`.
4. בוחרים רשימה: `עדכוני תוכנה` או `צופן חדש באוצר`.
5. לוחצים:
   - `שלח עדכון אוטומטי`
   - או `שלח צופן אוטומטי`

אם חסר מפתח Resend או שהפונקציה לא פורסמה, האתר יציג הודעה מתאימה.