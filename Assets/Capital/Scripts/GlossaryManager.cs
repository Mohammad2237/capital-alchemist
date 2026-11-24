using UnityEngine;
namespace Capital
{
    public sealed class GlossaryManager : MonoBehaviour
    {
        public static readonly string[] Names = { "رأس المال","المواد الخام","تكلفة الإنتاج","سعر البيع","الإيرادات","تكلفة البضاعة المباعة","إجمالي الربح","المخاطرة","المصروفات التشغيلية","صافي الربح" };
        public static readonly string[] Definitions = {
            "الأموال أو الموارد التي يبدأ بها صاحب المشروع نشاطه.",
            "المواد المستخدمة لصناعة المنتج.",
            "مجموع التكاليف المباشرة اللازمة لصناعة المنتج في هذه المحاكاة.",
            "المبلغ الذي يدفعه الزبون مقابل المنتج.",
            "الأموال الناتجة عن بيع المنتجات قبل طرح التكاليف.",
            "التكلفة المباشرة للمنتجات التي تم بيعها.",
            "الإيرادات ناقص تكلفة البضاعة المباعة.",
            "احتمال حدوث خسارة أو نتيجة غير متوقعة.",
            "تكاليف تشغيل المتجر غير الداخلة في تكلفة الجرعات مباشرة.",
            "إجمالي الربح بعد طرح خسائر التلف والمصروفات التشغيلية في هذه المحاكاة."
        };
        public bool Open { get; private set; }
        int page;
        public void Toggle()
        {
            if (!Open && IngredientInteraction.AnyHeld) { UIManager.I.Toast("ضع الأداة أولًا، ثم افتح الموسوعة"); return; }
            Open=!Open; GameManager.I.InteractionPaused=Open;
            if(Open) Show(0); else { UIManager.I.CloseModal(); GameDirector.I.Refresh(); }
        }
        public void Show(int index)
        {
            page=Mathf.Clamp(index,0,9);
            bool unlocked=GameManager.I.State.terms.Contains(page);
            string text=unlocked ? Names[page]+"\n\n"+Definitions[page]+"\n\n"+Example(page) : "مصطلح مغلق\nستكتشفه أثناء التجربة";
            UIManager.I.Modal("الموسوعة المالية   "+GameManager.I.State.terms.Count+" / 10",text,
                new Choice("السابق",()=>Show((page+9)%10)),new Choice("التالي",()=>Show((page+1)%10)),new Choice("عودة إلى المتجر",Toggle));
        }
        string Example(int i)
        {
            var s=GameManager.I.State;
            string[] examples={"بدأت بــ 100 عملة.","العشبة والبلورة والماء.","تكلفة جرعتك الأولى: 25 عملة.",
                "سعر جرعتك الأولى: "+s.firstPrice+" عملة.","إيراداتك حتى الآن: "+s.Revenue,
                "تكلفة ما بعته: "+s.COGS,"إجمالي ربحك: "+s.GrossProfit,
                "العشبة الذابلة قد تتلف الجرعة. النتيجة هنا مكتوبة وليست احتمالًا عشوائيًا.",
                "الإيجار والشموع والحطب: 10 عملات.","صافي ربحك حتى الآن: "+s.NetProfit};
            return examples[i];
        }
    }
}
