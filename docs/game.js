// Each purchase changes cash immediately. Costs are recognized when sold or discarded.
export class Shop {
  constructor() { this.step=0; this.cash=100; this.revenue=0; this.cogs=0; this.loss=0; this.expenses=0; }
  get orderPrice(){return this.price===30?37:30}
  get profit(){return this.revenue-this.cogs-this.loss-this.expenses}
  sale(receipts,cost){this.cash+=receipts;this.revenue+=receipts;this.cogs+=cost}
  get page(){
    switch(this.step){
      case 0:return ["إرث الخيميائي","فراس: تحتاج إلى عشب وبلّورة وماء وقارورة.","اشترِ المكوّنات • 25"];
      case 1:return ["طاولة التحضير","صوّب نحو العشبة الحمراء واضغط الزناد."];
      case 2:return ["الهاون","اضغط زر الطحن ثلاث مرات لسحق العشبة."];
      case 3:return ["البلّورة الزرقاء","صوّب نحو البلّورة واضغط لإضافتها إلى المرجل."];
      case 4:return ["الماء السحري","صوّب نحو إبريق الماء واضغط لإفراغه في المرجل."];
      case 5:return ["المرجل","اضغط زر التحريك ثلاث مرات لخلط المكوّنات."];
      case 6:return ["التعبئة","صوّب نحو القارورة الفارغة واضغط لملئها."];
      case 7:return ["الزبون الأول","كلّفتك الجرعة 25 قطعة. بأيّ سعر تبيعها؟","30 قطعة","50 قطعة"];
      case 8:return ["الزبون الأول","الإيراد "+this.price+"، وتكلفة الجرعة 25. كم بلغ إجمالي الربح؟",String(this.price-25),String(this.price)];
      case 9:return ["طلب التاجر",this.price===30?"أوصى بك الزبون! سأدفع 37 للجرعة. أحتاج إلى ثلاث.":"سأدفع 30 للجرعة. أحتاج إلى ثلاث.","مواد اقتصادية • 45","مواد ممتازة • 60"];
      case 10:return ["فحص الأعشاب","وجدت عشبة ذابلة. هل تستبدلها قبل تحضير الطلب؟","استبدلها • 5","استخدمها"];
      case 11:return ["طلب التاجر","حرّك مكوّنات الدفعة ثلاث مرات."];
      case 12:return ["تسليم الطلب","صوّب نحو القوارير واضغط لتسليم الطلب."];
      case 13:return ["دفتر الدكّان",this.loss?"رفض التاجر جرعة تالفة. خسرت تكلفتها: 15.":"استلم التاجر الجرعات الثلاث.","ادفع مصروفات التشغيل • 10"];
      case 14:return ["تقرير الدكّان","الإيراد "+this.revenue+"  •  تكلفة المبيعات "+this.cogs,"إجمالي الربح "+(this.revenue-this.cogs)+"   |   التلف "+this.loss+"   |   التشغيل "+this.expenses,"صافي الربح "+this.profit+"   |   الرصيد "+this.cash,"إعادة اللعب"];
    }
  }
  act(target){
    const items={1:"herb",2:"ground",3:"crystal",4:"water",5:"stirred",6:"vial",11:"stirred",12:"vial"};
    if(items[this.step] && target!==items[this.step])return false;
    switch(this.step){
      case 0:if(target!==0)return false;this.cash-=25;break;
      case 7:if(target!==0&&target!==1)return false;this.price=target===0?30:50;this.sale(this.price,25);break;
      case 8:if(target!==0)return false;break;
      case 9:if(target!==0&&target!==1)return false;this.batch=target===0?45:60;this.cash-=this.batch;if(target===1)this.step++;break;
      case 10:if(target!==0&&target!==1)return false;this.wilt=target===1;if(!this.wilt){this.cash-=5;this.batch+=5}break;
      case 12:this.loss=this.wilt?15:0;this.sale(this.orderPrice*(this.wilt?2:3),this.batch-this.loss);break;
      case 13:if(target!==0)return false;this.cash-=10;this.expenses=10;break;
      case 14:if(target!==2)return false;Object.assign(this,new Shop(),{wilt:false,price:0,batch:0});return true;
    }
    this.step++;return true;
  }
}
