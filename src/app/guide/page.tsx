import {
  Bell,
  Camera,
  CircleHelp,
  Gauge,
  IdCard,
  ListChecks,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sun,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";

export const metadata = { title: "ドライバーポータルの使い方" };

// ドライバー向けの使い方ガイド。ログイン不要 (proxy.ts の Basic 認証の対象外)。
// 画面写真は public/guide/ (デモデータで撮影)。

function Step({ n, icon: Icon, title, children }: { n: number; icon: typeof Bell; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-slate-200 px-5 py-8 first:border-t-0">
      <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm text-white">{n}</span>
        <Icon className="size-5 text-blue-600" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border-4 border-slate-800 shadow-lg">
      <Image src={src} alt={alt} width={780} height={1520} unoptimized className="h-auto w-full" />
    </figure>
  );
}

function Points({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 text-[15px] leading-relaxed text-slate-700">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <p className={`rounded-xl p-3 text-sm leading-relaxed ${tone === "warn" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-900"}`}>{children}</p>
  );
}

/** LINE のトーク画面とリッチメニューのイメージ (実際のメニューの他のボタンは各社で異なるためぼかす) */
function RichMenuMock() {
  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border-4 border-slate-800 bg-[#8cabd9] shadow-lg" aria-hidden>
      <div className="bg-[#1f2b3d] px-3 py-2 text-center text-xs font-bold text-white">会社の公式アカウント</div>
      <div className="space-y-2 p-3">
        <p className="w-fit max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[11px] text-slate-700">明日のシフトのお知らせです…</p>
        <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-tr-sm bg-[#8de055] px-3 py-2 text-[11px] text-slate-800">本日の業務終了しました</p>
      </div>
      <div className="grid grid-cols-3 gap-px bg-slate-300">
        {["", "", "車両管理", "", "", ""].map((label, i) =>
          label ? (
            <div key={i} className="relative flex h-14 flex-col items-center justify-center gap-0.5 bg-white text-[11px] font-bold text-blue-700 ring-4 ring-inset ring-amber-400">
              <span className="text-lg">🚗</span>
              {label}
              <span className="absolute -bottom-0.5 right-1 text-xl">👆</span>
            </div>
          ) : (
            <div key={i} className="h-14 bg-slate-50" />
          ),
        )}
      </div>
    </div>
  );
}

/** 期限が近いときに届く LINE のイメージ */
function NotifyMock() {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-2xl bg-[#8cabd9] p-3 shadow-inner" aria-hidden>
      <div className="rounded-2xl rounded-tl-sm bg-white p-3 text-[12px] leading-relaxed text-slate-700">
        佐藤 健一 さん
        <br />
        おつかれさまです。管理者です。
        <br />
        <br />
        運転免許証の有効期限まで あと30日です。
        <br />
        更新したら、新しい免許証の写真（表・裏）を送ってください。
        <br />
        <br />
        ▼ここから開けます（メニューの「車両管理」からも開けます）
        <br />
        <span className="break-all text-blue-600 underline">https://liff.line.me/…</span>
      </div>
    </div>
  );
}

export default async function GuidePage() {
  await connection();
  const adminPhone = process.env.ADMIN_PHONE ?? "";

  return (
    <main className="mx-auto min-h-screen max-w-md bg-white shadow-xl print:max-w-none print:shadow-none">
      <header className="bg-slate-900 px-5 pb-7 pt-8 text-white">
        <p className="text-xs font-bold text-blue-300">ドライバーのみなさまへ</p>
        <h1 className="mt-1 text-2xl font-bold">ドライバーポータルの使い方</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          走行距離の報告、免許証・車検証の提出、車のキズの報告を、スマホからできるようになりました。
          いつもの LINE の公式アカウントから開けます。
        </p>
        <ul className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
          {[
            { icon: Gauge, label: "走行距離の報告" },
            { icon: IdCard, label: "書類の提出" },
            { icon: Wrench, label: "キズの報告" },
          ].map(({ icon: Icon, label }) => (
            <li key={label} className="rounded-xl bg-slate-800 px-1 py-3">
              <Icon className="mx-auto mb-1 size-5 text-blue-300" />
              {label}
            </li>
          ))}
        </ul>
      </header>

      <Step n={1} icon={MessageCircle} title="開き方">
        <RichMenuMock />
        <Points
          items={[
            <>会社の LINE 公式アカウントのトーク画面を開きます。</>,
            <>画面の下のメニューから<b>「車両管理」</b>を押します。</>,
            <>あなた専用の画面が開きます。最初に「<b>今やること</b>」が表示されます。</>,
          ]}
        />
        <Note>
          はじめて開くときだけ、LINE の「許可する」画面が出ることがあります。「許可する」を押してください。
          LINE のアカウントで本人かどうかを確かめるためのもので、トークの内容や友だちを見ることはありません。
        </Note>
        <Note tone="warn">
          「LINE がまだ登録されていません」と出たときは、管理者から届く「LINE 登録用リンク」を LINE の中で開いてください。次からはメニューで開けるようになります。
        </Note>
      </Step>

      <Step n={2} icon={ListChecks} title="「今やること」を見る">
        <Shot src="/guide/home.jpg" alt="ホーム画面の「今やること」" />
        <Points
          items={[
            <>開くと、<b>あなたが今やること</b>だけが表示されます。</>,
            <>大きなボタンを押すと、そのまま提出・報告の画面に進みます。</>,
            <>赤いものは期限切れや締め切り過ぎです。先にお願いします。</>,
            <>何もなければ「<b>今やることはありません</b>」と表示されます。閉じて大丈夫です。</>,
          ]}
        />
      </Step>

      <Step n={3} icon={Gauge} title="走行距離を報告する（月1回）">
        <Shot src="/guide/daily.jpg" alt="「距離・状態」タブの画面" />
        <Points
          items={[
            <>「<b>距離・状態</b>」タブで、車のメーターの数字（走行距離）を入れます。</>,
            <>タイヤやランプ・ブレーキに<b>異常があるときだけ</b>チェックします。問題がなければ何もしなくて大丈夫です。</>,
            <>オイル交換をした日は「本日、オイル交換を実施した」にチェックを入れ、レシートかシールの写真を撮ります。</>,
            <>「<b>報告を送信する</b>」を押して完了です。</>,
          ]}
        />
        <Note>
          走行距離の報告は<b>毎月1回、1日〜7日</b>にお願いします。まだの人には、1日と5日の夜に LINE でお知らせが届きます。
          オイル交換をしたときは、月の途中でもその日に報告してください。
          キズなどを写真で伝えたいときは、⑤の「車両報告」から送ってください。
        </Note>
      </Step>

      <Step n={4} icon={IdCard} title="免許証・車検証を提出する">
        <Shot src="/guide/docs.jpg" alt="「各種提出」タブの画面" />
        <Points
          items={[
            <>「<b>各種提出</b>」タブで、提出する書類を選びます。期限が近い書類は赤く表示されます。</>,
            <>「写真を撮る」を押して撮影します。</>,
            <>AI が有効期限などを自動で読み取って入力します。<b>数字が合っているか必ず確認</b>し、違っていたら直してください。</>,
            <>「<b>この内容で送信する</b>」を押して完了です。</>,
          ]}
        />
        <Shot src="/guide/license.jpg" alt="免許証を撮影し、有効期限が自動で入った画面" />
        <ul className="space-y-1.5 rounded-xl border border-slate-200 p-4 text-sm leading-relaxed text-slate-700">
          <li><b>運転免許証</b>：表と裏の両方を撮ります（裏に何も書いていなくても必要です）。</li>
          <li><b>車検</b>：車検証と、一緒にもらう A4 の「検査証記録事項」を撮ります（満了日は A4 の紙に書いてあります）。</li>
          <li><b>自賠責</b>：保険期間が全部写るように撮ります。</li>
          <li><b>連絡先</b>：電話番号や緊急連絡先が変わったら、ここで直せます。</li>
        </ul>
      </Step>

      <Step n={5} icon={Wrench} title="車のキズ・不具合を報告する">
        <Shot src="/guide/defect.jpg" alt="「車両報告」タブの画面" />
        <Points
          items={[
            <>「<b>車両報告</b>」タブで、場所（例：左後ろのバンパー）を入れます。</>,
            <>キズや不具合の写真を撮ります（5枚まで追加できます）。</>,
            <>「<b>報告を送信する</b>」を押すと、管理者にすぐ届きます。</>,
          ]}
        />
        <Note tone="warn">
          <b>事故や故障など急ぎのときは、ここに入力せず、すぐに管理者へ電話してください。</b>
        </Note>
      </Step>

      <Step n={6} icon={Camera} title="きれいに撮るコツ">
        <ul className="grid grid-cols-2 gap-2 text-sm text-slate-700">
          {[
            { icon: Sun, text: "明るい場所で撮る" },
            { icon: ShieldCheck, text: "光が反射しない角度で" },
            { icon: IdCard, text: "書類の四隅まで全部入れる" },
            { icon: Camera, text: "ピントが合ってから押す" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
              <Icon className="size-4 shrink-0 text-blue-600" />
              {text}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-slate-600">
          文字がぼやけていると、AI が読み取れないことがあります。そのときは「撮り直す」を押してください。
        </p>
      </Step>

      <Step n={7} icon={Bell} title="LINE に届くお知らせ">
        <NotifyMock />
        <p className="text-[15px] leading-relaxed text-slate-700">
          免許証・車検・自賠責の期限が近づいたとき、オイル交換の時期になったとき、今月の走行距離がまだのときに、
          <b>夜10時ごろ</b>（シフトのお知らせと同じころ）LINE でお知らせが届きます。運転中に届くことはありません。
          リンクを押すと、やることの画面がそのまま開きます。
        </p>
        <Note>
          お知らせは期限の45日前・30日前・14日前・7日前など、節目の日だけです。同じ日のお知らせは1通にまとめます。提出が終わると止まります。
        </Note>
      </Step>

      <Step n={8} icon={CircleHelp} title="こまったとき">
        <ul className="space-y-2 text-[15px] leading-relaxed text-slate-700">
          <li>・ふだんの業務報告やシフトの連絡は、これまでどおり LINE のトークでやり取りできます。</li>
          <li>・画面が開かない、使い方がわからないときは、管理者に連絡してください。</li>
          <li>・提出した免許証などの写真は、会社の車両管理のためだけに使います。</li>
        </ul>
        {adminPhone && (
          <a
            href={`tel:${adminPhone}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-4 font-bold text-white print:hidden"
          >
            <Phone className="size-5" /> 管理者に電話する
          </a>
        )}
      </Step>
    </main>
  );
}
