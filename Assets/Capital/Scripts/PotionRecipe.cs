using UnityEngine;
namespace Capital
{
    [CreateAssetMenu(menuName="Capital/Potion Recipe")]
    public sealed class PotionRecipe : ScriptableObject
    {
        public string arabicName = "جرعة النشاط";
        public string[] ingredientNames = { "عشبة حمراء", "بلورة زرقاء", "ماء سحري", "قارورة" };
        public int[] costs = { 10, 8, 5, 2 };
        public Color potionColor = new Color(.12f,.72f,.43f);
        public int crushingStrokes = 5;
        public float stirringTurns = 2;
    }
}
