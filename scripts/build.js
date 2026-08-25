const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

const CATEGORY_ORDER = [
  "philosophy",
  "announcement",
  "surgery",
  "education",
  "story",
];

// English eyebrow codes, used in the related-articles widget for locales
// whose relatedChipStyle is "code" (currently just "en") and as the "en"
// entry of CATEGORY_EYEBROW below.
const CATEGORY_CODES = {
  philosophy: "PHILOSOPHY",
  announcement: "ANNOUNCEMENT",
  surgery: "SURGERY",
  education: "EDUCATION",
  story: "CASE NOTES",
  uncategorized: "LATEST",
};

// Per-locale short eyebrow labels for the homepage section headers
// (.section-eyebrow). Deliberately in each locale's own language rather
// than English-only codes — an all-caps English word above a Chinese/
// Vietnamese/Indonesian heading reads as an untranslated leftover, not a
// design choice. Only "en" itself uses English. Non-English locales keep
// the same mono, uppercase-letterspaced treatment where the script has
// case (vi/id); Han-script locales just use short local words.
const CATEGORY_EYEBROW = {
  en: CATEGORY_CODES,
  zh: {
    philosophy: "理念",
    announcement: "公告",
    surgery: "手術室",
    education: "衛教",
    story: "故事",
    uncategorized: "最新",
  },
  "zh-cn": {
    philosophy: "理念",
    announcement: "公告",
    surgery: "手术室",
    education: "科普",
    story: "故事",
    uncategorized: "最新",
  },
  vi: {
    philosophy: "TRIẾT LÝ",
    announcement: "THÔNG BÁO",
    surgery: "PHẪU THUẬT",
    education: "KIẾN THỨC",
    story: "CÂU CHUYỆN",
    uncategorized: "MỚI NHẤT",
  },
  id: {
    philosophy: "FILOSOFI",
    announcement: "KABAR",
    surgery: "BEDAH",
    education: "EDUKASI",
    story: "KISAH",
    uncategorized: "TERBARU",
  },
};

const CATEGORY_LABELS = {
  philosophy: "石醫師的醫療理念",
  announcement: "有關石醫師的醫療團隊",
  surgery: "石醫師的手術室",
  education: "漫談骨科",
  story: "臨床的小故事",
  uncategorized: "最新文章",
};

const CATEGORY_LABELS_EN = {
  philosophy: "Dr. Shih's Philosophy of Care",
  announcement: "Practice News",
  surgery: "Surgical Notes",
  education: "Orthopedic Insights",
  story: "Clinical Stories",
  uncategorized: "Latest",
};

const CATEGORY_LABELS_ZH_CN = {
  philosophy: "石医师的医疗理念",
  announcement: "石医师医疗团队动态",
  surgery: "石医师的手术室",
  education: "漫谈骨科",
  story: "临床小故事",
  uncategorized: "最新文章",
};

const CATEGORY_LABELS_VI = {
  philosophy: "Triết Lý Điều Trị Của Bác Sĩ Shih",
  announcement: "Tin Tức Phòng Khám",
  surgery: "Ghi Chép Phẫu Thuật",
  education: "Kiến Thức Chỉnh Hình",
  story: "Câu Chuyện Lâm Sàng",
  uncategorized: "Mới Nhất",
};

const CATEGORY_LABELS_ID = {
  philosophy: "Filosofi Perawatan Dr. Shih",
  announcement: "Kabar Klinik",
  surgery: "Catatan Bedah",
  education: "Wawasan Ortopedi",
  story: "Kisah Klinis",
  uncategorized: "Terbaru",
};

const SITE_URL = "https://drstone.daemet.com";
const SITE_NAME = "背後的力量｜石承民骨科醫師・脊椎外科筆記";
const SITE_NAME_EN = "Behind the Strength | Dr. Shih's Orthopedic & Spine Surgery Notes";
const SITE_NAME_ZH_CN = "背后的力量｜石承民骨科医师・脊柱外科笔记";
const SITE_NAME_VI = "Sức Mạnh Đằng Sau | Ghi Chép Phẫu Thuật Cột Sống Của Bác Sĩ Shih";
const SITE_NAME_ID = "Kekuatan di Baliknya | Catatan Bedah Tulang Belakang Dr. Shih";

const DOCTOR_NAME = "石承民";
const DOCTOR_NAME_EN = "Dr. Cheng-Min Shih";
const DOCTOR_NAME_ZH_CN = "石承民";
const DOCTOR_NAME_VI = "Bác sĩ Shih Cheng-Min";
const DOCTOR_NAME_ID = "Dr. Shih Cheng-Min";

const GA_MEASUREMENT_ID = "G-5S2TFQGC2L";

const PRIVACY_LINK_LABEL_ZH = "隱私權政策";
const PRIVACY_LINK_LABEL_EN = "Privacy Policy";
const PRIVACY_LINK_LABEL_ZH_CN = "隐私权政策";
const PRIVACY_LINK_LABEL_VI = "Chính Sách Bảo Mật";
const PRIVACY_LINK_LABEL_ID = "Kebijakan Privasi";

const DEFAULT_OG_IMAGE = "/assets/images/hero-cover.jpg";
const DOCTOR_PORTRAIT = "/assets/images/doctor-portrait.jpg";

// Doctor-specific deep links into each hospital's own registration system —
// no session/cookie state required, so these stay valid indefinitely (unlike
// e.g. reg.bch.org.tw's DoctorList.jsp entry point, which embeds a
// short-lived jsessionid and 500s without one).
const VGHTC_BOOKING_URL =
  "https://www.vghtc.gov.tw/DoctorInfoDetail/5994?stampId=5192E&OPDSECTION=ORTH";
const BCH_BOOKING_URL =
  "https://reg.bch.org.tw/WebReg/ym/reg/Reg?act=reg&div=C107&doctor_no=119616&drspway=X&divName=%B0%A9%AC%EC";

// Inline SVG globe icon for the lang-switch toggle, replacing a generic 🌐
// emoji — no external/paid icon set involved (project constraint: no
// paid icon packages), just a simple currentColor line icon that matches
// the button's own text color and its hover transition for free.
const LANG_SWITCH_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4.2 5.7 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.7-4.2-9S9.2 5.6 12 3z"/></svg>';

const HOME_DESCRIPTION_ZH =
  "石承民醫師，臺中榮民總醫院骨科部脊椎外科醫師，分享脊椎手術、脊椎滑脫、關節退化等骨科衛教知識與臨床經驗，協助您在治療決策前先做好準備。";
const HOME_DESCRIPTION_EN =
  "Dr. Cheng-Min Shih, orthopedic and spine surgeon at Taichung Veterans General Hospital, shares clinical insights on spine surgery, spondylolisthesis, joint conditions, and sports injuries.";
const HOME_DESCRIPTION_ZH_CN =
  "石承民医师，台中荣民总医院骨科部脊柱外科医师，分享脊柱手术、脊柱滑脱、关节退化等骨科科普知识与临床经验，协助您在治疗决策前先做好准备。";
const HOME_DESCRIPTION_VI =
  "Bác sĩ Shih Cheng-Min, bác sĩ chỉnh hình - cột sống tại Bệnh viện Cựu chiến binh Đài Trung, chia sẻ kinh nghiệm lâm sàng về phẫu thuật cột sống, trượt đốt sống, thoái hóa khớp và chấn thương thể thao.";
const HOME_DESCRIPTION_ID =
  "Dr. Shih Cheng-Min, dokter ortopedi dan tulang belakang di Rumah Sakit Umum Veteran Taichung, berbagi wawasan klinis tentang bedah tulang belakang, spondilolistesis, radang sendi, dan cedera olahraga.";

const ABOUT_TITLE_ZH = `醫師介紹｜${DOCTOR_NAME}骨科醫師・脊椎外科主任｜背後的力量`;
const ABOUT_TITLE_EN = "About Dr. Shih | Orthopedic & Spine Surgeon | Behind the Strength";
const ABOUT_TITLE_ZH_CN = "医师介绍｜石承民骨科医师・脊柱外科主任｜背后的力量";
const ABOUT_TITLE_VI = "Giới Thiệu Bác Sĩ Shih | Bác Sĩ Phẫu Thuật Cột Sống | Sức Mạnh Đằng Sau";
const ABOUT_TITLE_ID = "Tentang Dr. Shih | Dokter Bedah Tulang Belakang | Kekuatan di Baliknya";

const ABOUT_DESCRIPTION_ZH =
  "石承民醫師，臺中榮民總醫院骨科部脊椎外科主任，為專精脊椎手術的骨科醫師，擅長脊椎滑脫、椎間盤突出等疾病的微創治療，以及複雜脊椎翻修手術、膝髖關節重建與骨質疏鬆治療。";
const ABOUT_DESCRIPTION_EN =
  "Dr. Cheng-Min Shih, Chief of the Division of Spine Surgery at Taichung Veterans General Hospital and orthopedic spine surgeon specializing in spondylolisthesis, minimally invasive and complex spine surgery, spinal revision surgery, hip and knee reconstruction, and osteoporosis care.";
const ABOUT_DESCRIPTION_ZH_CN =
  "石承民医师，台中荣民总医院骨科部脊柱外科主任，为专精脊柱手术的骨科医师，擅长脊柱滑脱、椎间盘突出等疾病的微创治疗，以及复杂脊柱翻修手术、膝髋关节重建与骨质疏松治疗。";
const ABOUT_DESCRIPTION_VI =
  "Bác sĩ Shih Cheng-Min, Trưởng khoa Phẫu thuật Cột sống, Khoa Chỉnh hình, Bệnh viện Cựu chiến binh Đài Trung, là bác sĩ chuyên về phẫu thuật cột sống, điều trị trượt đốt sống, thoát vị đĩa đệm, phẫu thuật cột sống xâm lấn tối thiểu và tái phẫu thuật phức tạp, tái tạo khớp háng và khớp gối, cùng điều trị loãng xương.";
const ABOUT_DESCRIPTION_ID =
  "Dr. Shih Cheng-Min, Kepala Divisi Bedah Tulang Belakang, Departemen Ortopedi, Rumah Sakit Umum Veteran Taichung, adalah dokter spesialis bedah tulang belakang dengan fokus pada spondilolistesis, hernia diskus, bedah tulang belakang minim sayatan dan revisi kompleks, rekonstruksi sendi panggul dan lutut, serta penanganan osteoporosis.";

// FAQPage structured data — questions must mirror the visible FAQ section
// injected into about/index.html (BUILD:FAQ marker) exactly, since
// Google's structured-data guidelines require FAQ markup to match the
// on-page content it describes.
const FAQ_HEADING_ZH = "常見問題";
const FAQ_HEADING_EN = "Frequently Asked Questions";
const FAQ_HEADING_ZH_CN = "常见问题";
const FAQ_HEADING_VI = "Câu Hỏi Thường Gặp";
const FAQ_HEADING_ID = "Pertanyaan yang Sering Diajukan";

const FAQ_ZH = [
  {
    q: "下背痛合併下肢麻痛，一定要開刀嗎？",
    a: "不一定。無論是椎間盤突出、椎管狹窄或脊椎滑脫，多數情況都可以先透過復健、姿勢調整與藥物控制觀察，只有在保守治療效果有限、神經壓迫症狀（如下肢麻痛無力）持續影響生活時，才會建議手術治療。",
  },
  {
    q: "脊椎手術會不會傷到神經、造成癱瘓？",
    a: [
      "這確實是很多病人最擔心的問題。脊椎手術一定有神經損傷的風險，但不同手術的風險差別很大。像是常見的退化性脊椎疾病，例如椎間盤突出、脊椎狹窄造成的神經壓迫，或脊椎滑脫，手術後發生嚴重神經損傷或癱瘓的情況其實並不常見。但如果是大型脊椎矯正、脊椎腫瘤切除，或其他較複雜的手術，神經損傷的風險就會比較高。",
      "現在手術也有術中神經監測、影像導引等工具，可以幫助醫師在手術過程中掌握神經狀況與器械的位置。不過任何手術都不可能完全沒有風險，還是要依每個人的疾病和手術內容個別評估。",
      "對一般退化性脊椎手術來說，除了神經功能之外，術後更常需要留意的，其實是傷口是否順利癒合、有沒有感染，以及做了融合手術之後骨頭能不能順利長好。這些不只是醫師要注意，也需要病人在恢復期間一起配合。",
      "所以脊椎手術的安全，不只是手術當下有沒有傷到神經，手術後傷口恢復得好不好、骨頭能不能順利癒合，也都是很重要的事情。",
    ],
  },
  {
    q: "微創脊椎手術跟傳統手術有什麼不同？",
    a: "微創脊椎手術傷口較小、恢復期通常較短，但並非所有情況都適合，是否採用需視病灶的嚴重程度、位置與病人整體狀況而定，並非單純傷口大小的選擇。",
  },
  {
    q: "如何知道自己該找脊椎外科醫師還是先觀察就好？",
    a: "如果出現持續性下背痛、下肢放射痛麻，或走路距離明顯縮短等症狀，建議先由骨科／脊椎外科醫師評估影像與理學檢查結果，再共同討論觀察、復健或手術等後續處理方式。",
  },
];

const FAQ_EN = [
  {
    q: "Does lower back pain with leg numbness always require surgery?",
    a: "Not always. Whether it's a herniated disc, spinal stenosis, or spondylolisthesis, most cases can first be managed with rehabilitation, posture adjustments, and medication under observation. Surgery is typically recommended only when conservative treatment has limited effect and nerve compression symptoms — such as persistent numbness or weakness in the legs — continue to affect daily life.",
  },
  {
    q: "Will spine surgery damage nerves or cause paralysis?",
    a: [
      "This is genuinely one of the biggest worries for most patients. Spine surgery does carry a real risk of nerve injury, but that risk varies a great deal depending on the procedure. For common degenerative spine conditions — such as nerve compression from a herniated disc, spinal stenosis, or spondylolisthesis — serious nerve injury or paralysis after surgery is actually uncommon. For larger procedures such as major spinal deformity correction, spinal tumor removal, or other more complex surgeries, the risk of nerve injury is higher.",
      "Modern surgery also uses tools like intraoperative neuromonitoring and image guidance, which help the surgeon track nerve status and instrument position during the procedure. That said, no surgery can ever be entirely risk-free — the actual risk still needs to be assessed individually based on each patient's condition and the specific procedure involved.",
      "For typical degenerative spine surgery, beyond nerve function, what needs closer attention after the operation is usually whether the wound heals properly and stays free of infection, and — for fusion surgery — whether the bone fuses successfully. This isn't something only the surgeon needs to watch — it also requires the patient's cooperation during recovery.",
      "So the safety of spine surgery isn't just about whether the nerves were injured during the procedure — how well the wound recovers and whether the bone heals properly afterward matter just as much.",
    ],
  },
  {
    q: "What's the difference between minimally invasive and traditional spine surgery?",
    a: "Minimally invasive spine surgery typically involves smaller incisions and a shorter recovery period, but it isn't suitable for every case. Whether it's appropriate depends on the severity and location of the condition and the patient's overall condition, not simply a preference for a smaller incision.",
  },
  {
    q: "How do I know whether I should see a spine surgeon or just keep observing?",
    a: "If you have persistent lower back pain, radiating pain or numbness in the legs, or a noticeably shorter walking distance before symptoms appear, it's worth having an orthopedic or spine surgeon evaluate your imaging and physical exam findings, so you can discuss observation, rehabilitation, or surgery together based on the actual findings.",
  },
];

const FAQ_ZH_CN = [
  {
    q: "下背痛合并下肢麻痛，一定要开刀吗？",
    a: "不一定。无论是椎间盘突出、椎管狭窄或脊柱滑脱，多数情况都可以先通过复健、姿势调整与药物控制观察，只有在保守治疗效果有限、神经压迫症状（如下肢麻痛无力）持续影响生活时，才会建议手术治疗。",
  },
  {
    q: "脊柱手术会不会伤到神经、造成瘫痪？",
    a: [
      "这确实是很多病人最担心的问题。脊柱手术一定有神经损伤的风险，但不同手术的风险差别很大。像是常见的退化性脊柱疾病，例如椎间盘突出、椎管狭窄造成的神经压迫，或脊柱滑脱，手术后发生严重神经损伤或瘫痪的情况其实并不常见。但如果是大型脊柱矫正、脊柱肿瘤切除，或其他较复杂的手术，神经损伤的风险就会比较高。",
      "现在手术也有术中神经监测、影像导引等工具，可以帮助医师在手术过程中掌握神经状况与器械的位置。不过任何手术都不可能完全没有风险，还是要依每个人的疾病和手术内容个别评估。",
      "对一般退化性脊柱手术来说，除了神经功能之外，术后更常需要留意的，其实是伤口是否顺利愈合、有没有感染，以及做了融合手术之后骨头能不能顺利长好。这些不只是医师要注意，也需要病人在恢复期间一起配合。",
      "所以脊柱手术的安全，不只是手术当下有没有伤到神经，手术后伤口恢复得好不好、骨头能不能顺利愈合，也都是很重要的事情。",
    ],
  },
  {
    q: "微创脊柱手术跟传统手术有什么不同？",
    a: "微创脊柱手术伤口较小、恢复期通常较短，但并非所有情况都适合，是否采用需视病灶的严重程度、位置与病人整体状况而定，并非单纯伤口大小的选择。",
  },
  {
    q: "如何知道自己该找脊柱外科医师还是先观察就好？",
    a: "如果出现持续性下背痛、下肢放射痛麻，或走路距离明显缩短等症状，建议先由骨科／脊柱外科医师评估影像与体格检查结果，再共同讨论观察、复健或手术等后续处理方式。",
  },
];

const FAQ_VI = [
  {
    q: "Đau lưng dưới kèm tê chân có nhất thiết phải phẫu thuật không?",
    a: "Không nhất thiết. Dù là thoát vị đĩa đệm, hẹp ống sống hay trượt đốt sống, phần lớn các trường hợp đều có thể được theo dõi trước bằng phục hồi chức năng, điều chỉnh tư thế và dùng thuốc. Phẫu thuật thường chỉ được khuyến nghị khi điều trị bảo tồn có hiệu quả hạn chế và các triệu chứng chèn ép thần kinh — như tê yếu chân kéo dài — vẫn tiếp tục ảnh hưởng đến sinh hoạt hằng ngày.",
  },
  {
    q: "Phẫu thuật cột sống có làm tổn thương thần kinh, gây liệt không?",
    a: [
      "Đây thực sự là điều mà rất nhiều bệnh nhân lo lắng nhất. Phẫu thuật cột sống chắc chắn có nguy cơ tổn thương thần kinh, nhưng mức độ rủi ro khác nhau rất nhiều tùy theo loại phẫu thuật. Với các bệnh lý cột sống thoái hóa thường gặp — như chèn ép thần kinh do thoát vị đĩa đệm, hẹp ống sống, hoặc trượt đốt sống — tình trạng tổn thương thần kinh nghiêm trọng hay liệt sau mổ thực ra không phổ biến. Nhưng nếu là các ca phẫu thuật lớn như chỉnh sửa biến dạng cột sống quy mô lớn, cắt bỏ khối u cột sống, hoặc các ca phức tạp khác, thì nguy cơ tổn thương thần kinh sẽ cao hơn.",
      "Hiện nay phẫu thuật cũng có các công cụ như theo dõi thần kinh trong mổ, định vị hình ảnh, giúp bác sĩ nắm được tình trạng thần kinh và vị trí dụng cụ trong suốt quá trình phẫu thuật. Tuy nhiên không có ca phẫu thuật nào hoàn toàn không có rủi ro, vẫn cần đánh giá riêng theo từng bệnh lý và nội dung phẫu thuật của mỗi người.",
      "Đối với phẫu thuật cột sống thoái hóa thông thường, ngoài chức năng thần kinh, điều cần chú ý nhiều hơn sau mổ thực ra là vết mổ có lành tốt không, có bị nhiễm trùng không, và sau phẫu thuật hàn xương thì xương có liền tốt hay không. Đây không chỉ là điều bác sĩ cần lưu ý, mà bệnh nhân cũng cần phối hợp trong giai đoạn hồi phục.",
      "Vì vậy, sự an toàn của phẫu thuật cột sống không chỉ nằm ở việc có tổn thương thần kinh trong lúc mổ hay không — vết mổ hồi phục có tốt không, xương có liền tốt hay không sau đó cũng đều rất quan trọng.",
    ],
  },
  {
    q: "Phẫu thuật cột sống xâm lấn tối thiểu khác gì so với phẫu thuật truyền thống?",
    a: "Phẫu thuật cột sống xâm lấn tối thiểu thường có vết mổ nhỏ hơn và thời gian hồi phục ngắn hơn, nhưng không phải trường hợp nào cũng phù hợp. Việc áp dụng phương pháp này phụ thuộc vào mức độ nghiêm trọng và vị trí của tổn thương cũng như tình trạng tổng thể của bệnh nhân, chứ không đơn thuần là lựa chọn vết mổ nhỏ.",
  },
  {
    q: "Làm sao biết nên đi khám bác sĩ phẫu thuật cột sống hay chỉ cần theo dõi?",
    a: "Nếu bạn bị đau lưng dưới kéo dài, đau hoặc tê lan xuống chân, hoặc quãng đường đi bộ trước khi xuất hiện triệu chứng ngày càng ngắn lại, nên để bác sĩ chỉnh hình hoặc bác sĩ phẫu thuật cột sống đánh giá hình ảnh và khám lâm sàng, sau đó cùng thảo luận hướng xử trí tiếp theo là theo dõi, phục hồi chức năng hay phẫu thuật.",
  },
];

const FAQ_ID = [
  {
    q: "Apakah nyeri punggung bawah disertai kebas kaki selalu memerlukan operasi?",
    a: "Tidak selalu. Baik itu hernia diskus, stenosis tulang belakang, maupun spondilolistesis, sebagian besar kasus dapat terlebih dahulu ditangani dengan rehabilitasi, penyesuaian postur, dan obat-obatan sambil diobservasi. Operasi biasanya baru direkomendasikan jika pengobatan konservatif kurang efektif dan gejala penekanan saraf — seperti kebas atau kelemahan pada kaki yang berlanjut — terus memengaruhi aktivitas sehari-hari.",
  },
  {
    q: "Apakah operasi tulang belakang bisa merusak saraf dan menyebabkan kelumpuhan?",
    a: [
      "Ini memang menjadi kekhawatiran terbesar bagi kebanyakan pasien. Operasi tulang belakang memang memiliki risiko cedera saraf, tetapi tingkat risikonya sangat bervariasi tergantung jenis operasinya. Untuk kondisi tulang belakang degeneratif yang umum — seperti penekanan saraf akibat hernia diskus, stenosis tulang belakang, atau spondilolistesis — cedera saraf serius atau kelumpuhan setelah operasi sebenarnya jarang terjadi. Namun untuk operasi besar seperti koreksi deformitas tulang belakang skala besar, pengangkatan tumor tulang belakang, atau operasi kompleks lainnya, risiko cedera saraf akan lebih tinggi.",
      "Operasi saat ini juga dilengkapi alat seperti pemantauan saraf intraoperatif dan panduan citra, yang membantu dokter memantau kondisi saraf dan posisi instrumen selama operasi berlangsung. Meski begitu, tidak ada operasi yang sepenuhnya bebas risiko — tetap perlu dievaluasi secara individual berdasarkan kondisi dan jenis operasi masing-masing pasien.",
      "Untuk operasi tulang belakang degeneratif pada umumnya, selain fungsi saraf, yang lebih perlu diperhatikan setelah operasi sebenarnya adalah apakah luka sembuh dengan baik dan bebas infeksi, serta — untuk operasi fusi — apakah tulang menyatu dengan baik. Ini bukan hanya hal yang perlu diperhatikan dokter, tetapi juga memerlukan kerja sama pasien selama masa pemulihan.",
      "Jadi keamanan operasi tulang belakang bukan hanya soal apakah saraf terluka saat operasi berlangsung — seberapa baik luka pulih dan apakah tulang menyatu dengan baik setelahnya juga sama pentingnya.",
    ],
  },
  {
    q: "Apa bedanya operasi tulang belakang minim sayatan dengan operasi konvensional?",
    a: "Operasi tulang belakang minim sayatan umumnya memiliki sayatan lebih kecil dan masa pemulihan yang lebih singkat, tetapi tidak cocok untuk semua kondisi. Kesesuaiannya tergantung pada tingkat keparahan dan lokasi kelainan serta kondisi keseluruhan pasien, bukan sekadar preferensi sayatan yang lebih kecil.",
  },
  {
    q: "Bagaimana saya tahu harus menemui dokter bedah tulang belakang atau cukup diobservasi saja?",
    a: "Jika Anda mengalami nyeri punggung bawah yang menetap, nyeri atau kebas menjalar ke kaki, atau jarak berjalan yang semakin pendek sebelum gejala muncul, sebaiknya minta dokter ortopedi atau bedah tulang belakang mengevaluasi hasil citra medis dan pemeriksaan fisik, lalu bersama-sama mendiskusikan apakah perlu observasi, rehabilitasi, atau operasi.",
  },
];

// Draft copy — review before shipping, matches the site's quiet,
// fact-grounded tone (not marketing language). Same fields as
// _shared/locales.ts's confirm/notification email copy, but for the
// on-page subscribe form + confirm/unsubscribe landing pages.
const SUBSCRIBE_COPY_ZH = {
  label: "文章通知",
  heading: "訂閱新文章通知",
  desc: "新文章發布時，以電子郵件通知您，可隨時取消訂閱。",
  placeholder: "電子郵件",
  submit: "訂閱",
  success: "感謝訂閱，請至信箱點擊確認連結完成訂閱。",
  error: "訂閱時發生問題，請稍後再試。",
  invalid: "請輸入有效的電子郵件地址。",
  confirmedHeading: "訂閱確認",
  confirmedSuccess: "您已成功訂閱新文章通知。",
  confirmedError: "確認連結無效或已過期，請重新訂閱。",
  unsubscribedHeading: "取消訂閱",
  unsubscribedSuccess: "您已取消訂閱，將不再收到新文章通知。",
  unsubscribedError: "連結無效，請確認網址是否完整。",
  backLink: "回首頁",
};

const SUBSCRIBE_COPY_EN = {
  label: "Article Updates",
  heading: "Get notified about new articles",
  desc: "Receive an email when a new article is published. Unsubscribe anytime.",
  placeholder: "Email address",
  submit: "Subscribe",
  success: "Thanks — check your inbox to confirm your subscription.",
  error: "Something went wrong. Please try again later.",
  invalid: "Please enter a valid email address.",
  confirmedHeading: "Confirm Subscription",
  confirmedSuccess: "You're subscribed to new article notifications.",
  confirmedError: "This confirmation link is invalid or expired — please subscribe again.",
  unsubscribedHeading: "Unsubscribe",
  unsubscribedSuccess: "You've been unsubscribed and won't receive further notifications.",
  unsubscribedError: "This link is invalid — please check the URL.",
  backLink: "Back to home",
};

const SUBSCRIBE_COPY_ZH_CN = {
  label: "文章通知",
  heading: "订阅新文章通知",
  desc: "新文章发布时，以电子邮件通知您，可随时取消订阅。",
  placeholder: "电子邮件",
  submit: "订阅",
  success: "感谢订阅，请至邮箱点击确认链接完成订阅。",
  error: "订阅时发生问题，请稍后再试。",
  invalid: "请输入有效的电子邮件地址。",
  confirmedHeading: "订阅确认",
  confirmedSuccess: "您已成功订阅新文章通知。",
  confirmedError: "确认链接无效或已过期，请重新订阅。",
  unsubscribedHeading: "取消订阅",
  unsubscribedSuccess: "您已取消订阅，将不再收到新文章通知。",
  unsubscribedError: "链接无效，请确认网址是否完整。",
  backLink: "回首页",
};

const SUBSCRIBE_COPY_VI = {
  label: "Thông Báo Bài Viết",
  heading: "Nhận thông báo bài viết mới",
  desc: "Chúng tôi sẽ gửi email khi có bài viết mới. Bạn có thể hủy đăng ký bất cứ lúc nào.",
  placeholder: "Địa chỉ email",
  submit: "Đăng ký",
  success: "Cảm ơn bạn — vui lòng kiểm tra hộp thư để xác nhận đăng ký.",
  error: "Đã xảy ra lỗi. Vui lòng thử lại sau.",
  invalid: "Vui lòng nhập địa chỉ email hợp lệ.",
  confirmedHeading: "Xác Nhận Đăng Ký",
  confirmedSuccess: "Bạn đã đăng ký nhận thông báo bài viết mới thành công.",
  confirmedError: "Liên kết xác nhận không hợp lệ hoặc đã hết hạn — vui lòng đăng ký lại.",
  unsubscribedHeading: "Hủy Đăng Ký",
  unsubscribedSuccess: "Bạn đã hủy đăng ký và sẽ không nhận thêm thông báo.",
  unsubscribedError: "Liên kết không hợp lệ — vui lòng kiểm tra lại URL.",
  backLink: "Về trang chủ",
};

const SUBSCRIBE_COPY_ID = {
  label: "Pemberitahuan Artikel",
  heading: "Dapatkan pemberitahuan artikel baru",
  desc: "Kami akan mengirim email saat ada artikel baru. Anda dapat berhenti berlangganan kapan saja.",
  placeholder: "Alamat email",
  submit: "Berlangganan",
  success: "Terima kasih — silakan periksa kotak masuk untuk mengonfirmasi langganan Anda.",
  error: "Terjadi kesalahan. Silakan coba lagi nanti.",
  invalid: "Silakan masukkan alamat email yang valid.",
  confirmedHeading: "Konfirmasi Langganan",
  confirmedSuccess: "Anda telah berhasil berlangganan pemberitahuan artikel baru.",
  confirmedError: "Tautan konfirmasi tidak valid atau telah kedaluwarsa — silakan berlangganan lagi.",
  unsubscribedHeading: "Berhenti Berlangganan",
  unsubscribedSuccess: "Anda telah berhenti berlangganan dan tidak akan menerima pemberitahuan lagi.",
  unsubscribedError: "Tautan tidak valid — silakan periksa kembali URL-nya.",
  backLink: "Kembali ke beranda",
};

// Every locale-aware function in this file reads from LOCALES instead of
// hand-duplicating a branch per language. To add a locale: add an entry
// here, create its directory with the same shape as en/, and re-run the
// build — every generation step (SEO, sitemap, RSS, related-articles,
// friend-links, lang-switch) picks it up automatically. Entries whose
// directory doesn't exist on disk yet are silently skipped everywhere via
// fs.existsSync guards, so adding metadata ahead of content is safe.
const LOCALES = [
  {
    code: "zh",
    dir: "",
    isDefault: true,
    htmlLang: "zh-Hant",
    hreflang: "zh-Hant",
    ogLocale: "zh_TW",
    inLanguage: "zh-Hant-TW",
    rssLanguage: "zh-tw",
    siteName: SITE_NAME,
    doctorName: DOCTOR_NAME,
    homeDescription: HOME_DESCRIPTION_ZH,
    rssDescription: HOME_DESCRIPTION_ZH,
    aboutTitle: ABOUT_TITLE_ZH,
    aboutDescription: ABOUT_DESCRIPTION_ZH,
    faqHeading: FAQ_HEADING_ZH,
    faq: FAQ_ZH,
    hospitalName: "臺中榮民總醫院",
    bookingToggleLabel: "門診掛號",
    hospitalNameShort: "台中榮總",
    secondHospitalNameShort: "正德醫院",
    alumniOf: ["陽明交通大學", "高雄醫學大學"],
    categoryLabels: CATEGORY_LABELS,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "中文",
    subscribeCopy: SUBSCRIBE_COPY_ZH,
    privacyLinkLabel: PRIVACY_LINK_LABEL_ZH,
  },
  {
    code: "en",
    dir: "en",
    isDefault: false,
    htmlLang: "en",
    hreflang: "en",
    ogLocale: "en_US",
    inLanguage: "en",
    rssLanguage: "en-us",
    siteName: SITE_NAME_EN,
    doctorName: DOCTOR_NAME_EN,
    homeDescription: HOME_DESCRIPTION_EN,
    rssDescription: HOME_DESCRIPTION_EN,
    aboutTitle: ABOUT_TITLE_EN,
    aboutDescription: ABOUT_DESCRIPTION_EN,
    faqHeading: FAQ_HEADING_EN,
    faq: FAQ_EN,
    hospitalName: "Taichung Veterans General Hospital",
    bookingToggleLabel: "Book an Appointment",
    hospitalNameShort: "Taichung VGH",
    secondHospitalNameShort: "Cheng Te Hospital",
    alumniOf: ["National Yang Ming Chiao Tung University", "Kaohsiung Medical University"],
    categoryLabels: CATEGORY_LABELS_EN,
    relatedChipStyle: "code",
    langSwitchSelfLabel: "English",
    subscribeCopy: SUBSCRIBE_COPY_EN,
    privacyLinkLabel: PRIVACY_LINK_LABEL_EN,
  },
  {
    code: "zh-cn",
    dir: "zh-cn",
    isDefault: false,
    htmlLang: "zh-CN",
    hreflang: "zh-CN",
    ogLocale: "zh_CN",
    inLanguage: "zh-Hans-CN",
    rssLanguage: "zh-cn",
    siteName: SITE_NAME_ZH_CN,
    doctorName: DOCTOR_NAME_ZH_CN,
    homeDescription: HOME_DESCRIPTION_ZH_CN,
    rssDescription: HOME_DESCRIPTION_ZH_CN,
    aboutTitle: ABOUT_TITLE_ZH_CN,
    aboutDescription: ABOUT_DESCRIPTION_ZH_CN,
    faqHeading: FAQ_HEADING_ZH_CN,
    faq: FAQ_ZH_CN,
    hospitalName: "台中荣民总医院",
    bookingToggleLabel: "门诊挂号",
    hospitalNameShort: "台中荣总",
    secondHospitalNameShort: "佛教正德医院",
    alumniOf: ["阳明交通大学", "高雄医学大学"],
    categoryLabels: CATEGORY_LABELS_ZH_CN,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "简体中文",
    subscribeCopy: SUBSCRIBE_COPY_ZH_CN,
    privacyLinkLabel: PRIVACY_LINK_LABEL_ZH_CN,
  },
  {
    code: "vi",
    dir: "vi",
    isDefault: false,
    htmlLang: "vi",
    hreflang: "vi",
    ogLocale: "vi_VN",
    inLanguage: "vi",
    rssLanguage: "vi",
    siteName: SITE_NAME_VI,
    doctorName: DOCTOR_NAME_VI,
    homeDescription: HOME_DESCRIPTION_VI,
    rssDescription: HOME_DESCRIPTION_VI,
    aboutTitle: ABOUT_TITLE_VI,
    aboutDescription: ABOUT_DESCRIPTION_VI,
    faqHeading: FAQ_HEADING_VI,
    faq: FAQ_VI,
    hospitalName: "Bệnh viện Cựu chiến binh Đài Trung",
    bookingToggleLabel: "Đặt Lịch Khám",
    hospitalNameShort: "BV Cựu Chiến Binh Đài Trung",
    secondHospitalNameShort: "BV Cheng Te",
    alumniOf: ["Đại học Quốc lập Dương Minh Giao Thông", "Đại học Y khoa Cao Hùng"],
    categoryLabels: CATEGORY_LABELS_VI,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "Tiếng Việt",
    subscribeCopy: SUBSCRIBE_COPY_VI,
    privacyLinkLabel: PRIVACY_LINK_LABEL_VI,
  },
  {
    code: "id",
    dir: "id",
    isDefault: false,
    htmlLang: "id",
    hreflang: "id",
    ogLocale: "id_ID",
    inLanguage: "id",
    rssLanguage: "id",
    siteName: SITE_NAME_ID,
    doctorName: DOCTOR_NAME_ID,
    homeDescription: HOME_DESCRIPTION_ID,
    rssDescription: HOME_DESCRIPTION_ID,
    aboutTitle: ABOUT_TITLE_ID,
    aboutDescription: ABOUT_DESCRIPTION_ID,
    faqHeading: FAQ_HEADING_ID,
    faq: FAQ_ID,
    hospitalName: "Rumah Sakit Umum Veteran Taichung",
    bookingToggleLabel: "Buat Janji Temu",
    hospitalNameShort: "RS Veteran Taichung",
    secondHospitalNameShort: "RS Cheng Te",
    alumniOf: ["Universitas Nasional Yang Ming Chiao Tung", "Universitas Kedokteran Kaohsiung"],
    categoryLabels: CATEGORY_LABELS_ID,
    relatedChipStyle: "full",
    langSwitchSelfLabel: "Bahasa Indonesia",
    subscribeCopy: SUBSCRIBE_COPY_ID,
    privacyLinkLabel: PRIVACY_LINK_LABEL_ID,
  },
];
const LOCALES_BY_CODE = Object.fromEntries(LOCALES.map((l) => [l.code, l]));
const DEFAULT_LOCALE = LOCALES.find((l) => l.isDefault);

// Static page directories that exist once per locale (not blog articles).
const PAGE_DIRS = new Set(["about", "media", "line", "privacy"]);
// Everything the root (default-locale) article scan must skip: the static
// page dirs, non-content tooling dirs, and every other locale's directory.
const ROOT_IGNORE_DIRS = new Set([
  ...PAGE_DIRS,
  "assets",
  "scripts",
  "node_modules",
  ".git",
  ".github",
  "dist",
  "supabase",
  "subscribe",
  "idea-capture-9b0436e5ce39ba5884a3cb1f18952684",
  ...LOCALES.filter((l) => l.dir).map((l) => l.dir),
]);

function localeUrl(locale, suffix = "") {
  return locale.dir ? `${SITE_URL}/${locale.dir}/${suffix}` : `${SITE_URL}/${suffix}`;
}

function localePath(locale, suffix = "") {
  return locale.dir ? `/${locale.dir}/${suffix}` : `/${suffix}`;
}

// Partner / collaborator links shown in every page's footer.
// Add future collaborators here — one `labels` entry per locale, plus the url.
const FRIEND_LINKS = [
  {
    labels: {
      zh: "背後的力量 Facebook 粉絲專頁",
      en: "Behind the Strength on Facebook",
      "zh-cn": "背后的力量 Facebook 主页",
      vi: "Trang Facebook Sức Mạnh Đằng Sau",
      id: "Halaman Facebook Kekuatan di Baliknya",
    },
    url: "https://www.facebook.com/profile.php?id=61581620385517",
  },
];

const FRIEND_LINKS_HEADING = {
  zh: "友好連結",
  en: "Partner Links",
  "zh-cn": "友情链接",
  vi: "Liên Kết Đối Tác",
  id: "Tautan Mitra",
};

function readMeta(html, name) {
  // content is always double-quoted in this codebase; only "
  // terminates the match so apostrophes in English copy ("It's",
  // "What's") don't truncate the captured value early.
  const re = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content="([^"]*)"\\s*/?>`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

function gitLastModified(absPath) {
  try {
    const relPath = path.relative(ROOT, absPath).split(path.sep).join("/");
    const out = execSync(`git log -1 --format=%cI -- "${relPath}"`, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (out) return out;
  } catch (e) {
    // not in a git repo yet, or file untracked
  }
  return null;
}

function findArticlesIn(baseDir, ignoreDirs, dirPrefix) {
  if (!fs.existsSync(baseDir)) return [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const articles = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || ignoreDirs.has(entry.name)) continue;
    const indexPath = path.join(baseDir, entry.name, "index.html");
    if (!fs.existsSync(indexPath)) continue;

    const html = fs.readFileSync(indexPath, "utf8");
    const slug = readMeta(html, "article:slug") || entry.name;
    const title = readMeta(html, "article:title") || slug;
    const excerpt = readMeta(html, "article:excerpt") || "";
    const publishedDate = readMeta(html, "article:date") || "";
    const author = readMeta(html, "article:author") || "";
    const category = readMeta(html, "article:category") || "uncategorized";
    const orderMeta = readMeta(html, "article:order");
    const manualOrder = orderMeta !== null ? Number(orderMeta) : null;

    const gitSortKey = gitLastModified(indexPath);
    const sortKey = gitSortKey || publishedDate || new Date().toISOString();
    const updatedDate = sortKey.slice(0, 10);

    const publishedMs = publishedDate ? new Date(publishedDate).getTime() : NaN;
    const isNew = !Number.isNaN(publishedMs) && Date.now() - publishedMs < NEW_BADGE_WINDOW_MS;

    // Homepage list thumbnail: only for articles that already have a real
    // hero photo (class="post-hero-img"), reusing a pre-generated -thumb.jpg
    // sibling if one exists. Articles without a photo (most of the
    // philosophy/education pieces) simply render without a thumbnail —
    // deliberately not auto-generating a placeholder for those.
    let thumbnail = null;
    const heroMatch = html.match(/class="post-hero-img"[\s\S]*?src="\/assets\/images\/([^"]+)\.jpg"/);
    if (heroMatch) {
      const thumbPath = path.join(ROOT, "assets", "images", `${heroMatch[1]}-thumb.jpg`);
      if (fs.existsSync(thumbPath)) thumbnail = `/assets/images/${heroMatch[1]}-thumb.jpg`;
    }

    articles.push({
      dir: dirPrefix + entry.name,
      indexPath,
      slug,
      title,
      excerpt,
      publishedDate,
      author,
      category,
      updatedDate,
      sortKey,
      manualOrder,
      isNew,
      thumbnail,
    });
  }

  // Articles with an explicit article:order meta sort by that number
  // (higher = newer = shown first). Articles without it fall back to
  // git last-modified time and are always treated as newer than any
  // manually ordered article, so freshly added posts bubble to the top
  // automatically without needing article:order to be set by hand.
  articles.sort((a, b) => {
    if (a.manualOrder !== null && b.manualOrder !== null) {
      return b.manualOrder - a.manualOrder;
    }
    if (a.manualOrder !== null) return 1;
    if (b.manualOrder !== null) return -1;
    return a.sortKey < b.sortKey ? 1 : -1;
  });
  return articles;
}

function findAllArticles() {
  const result = {};
  for (const locale of LOCALES) {
    const baseDir = locale.dir ? path.join(ROOT, locale.dir) : ROOT;
    const ignoreDirs = locale.isDefault ? ROOT_IGNORE_DIRS : PAGE_DIRS;
    const dirPrefix = locale.dir ? locale.dir + "/" : "";
    result[locale.code] = findArticlesIn(baseDir, ignoreDirs, dirPrefix);
  }
  return result;
}

function updateArticleCategoryLabel(article, labels) {
  let html = fs.readFileSync(article.indexPath, "utf8");
  const label = labels[article.category] || labels.uncategorized;
  const re = /(<span class="post-category">)[^<]*(<\/span>)/;
  if (!re.test(html)) return;
  const next = html.replace(re, `$1${label}$2`);
  if (next !== html) {
    fs.writeFileSync(article.indexPath, next, "utf8");
  }
}

function updateArticleUpdatedMarker(article) {
  let html = fs.readFileSync(article.indexPath, "utf8");
  const re = /<!-- BUILD:UPDATED:START -->[\s\S]*?<!-- BUILD:UPDATED:END -->/;
  if (!re.test(html)) return;
  const replacement = `<!-- BUILD:UPDATED:START -->${article.updatedDate}<!-- BUILD:UPDATED:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(article.indexPath, next, "utf8");
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractHeroImage(html) {
  const m = html.match(
    /<img\s+class="(?:hero-img|post-hero-img)"[\s\S]*?src="([^"]+)"/
  );
  return m ? m[1] : DEFAULT_OG_IMAGE;
}

function jsonLdScript(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(
    obj,
    null,
    2
  )}\n  </script>`;
}

function commonOgTags({ title, description, url, image, type, locale }) {
  const loc = LOCALES_BY_CODE[locale];
  return [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${escapeHtml(loc.siteName)}" />`,
    `<meta property="og:locale" content="${loc.ogLocale}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
}

// Accepts a sparse {localeCode: url} map and emits one alternate tag per
// present locale (in LOCALES order) plus one x-default pointing at the
// default locale's URL.
function hreflangTags(urlsByLocale) {
  const tags = [];
  for (const locale of LOCALES) {
    const url = urlsByLocale[locale.code];
    if (url) tags.push(`<link rel="alternate" hreflang="${locale.hreflang}" href="${url}" />`);
  }
  const defaultUrl = urlsByLocale[DEFAULT_LOCALE.code];
  if (defaultUrl) tags.push(`<link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`);
  return tags;
}

function buildArticleSeo(article, html, locale, counterpartsByLocale) {
  const loc = LOCALES_BY_CODE[locale];
  const url = `${SITE_URL}/${article.dir}/`;
  const image = SITE_URL + extractHeroImage(html);
  const tags = commonOgTags({
    title: article.title,
    description: article.excerpt,
    url,
    image,
    type: "article",
    locale,
  });
  tags.push(
    `<meta property="article:published_time" content="${article.publishedDate}" />`,
    `<meta property="article:modified_time" content="${article.updatedDate}" />`
  );

  const urlsByLocale = {};
  for (const l of LOCALES) {
    if (l.code === locale) {
      urlsByLocale[l.code] = url;
    } else if (counterpartsByLocale && counterpartsByLocale[l.code]) {
      urlsByLocale[l.code] = `${SITE_URL}/${counterpartsByLocale[l.code].dir}/`;
    }
  }
  tags.push(...hreflangTags(urlsByLocale));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    headline: article.title,
    description: article.excerpt,
    image,
    author: {
      "@type": "Person",
      name: article.author || loc.doctorName,
    },
    publisher: {
      "@type": "Organization",
      name: loc.siteName,
      logo: { "@type": "ImageObject", url: SITE_URL + DOCTOR_PORTRAIT },
    },
    datePublished: article.publishedDate,
    dateModified: article.updatedDate,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: loc.inLanguage,
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildHomeSeo(locale) {
  const loc = LOCALES_BY_CODE[locale];
  const url = localeUrl(loc);
  const image = SITE_URL + DEFAULT_OG_IMAGE;
  const tags = commonOgTags({
    title: loc.siteName,
    description: loc.homeDescription,
    url,
    image,
    type: "website",
    locale,
  });

  const urlsByLocale = {};
  for (const l of LOCALES) {
    if (fs.existsSync(path.join(ROOT, l.dir, "index.html"))) {
      urlsByLocale[l.code] = localeUrl(l);
    }
  }
  tags.push(...hreflangTags(urlsByLocale));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: loc.siteName,
    url,
    description: loc.homeDescription,
    inLanguage: loc.inLanguage,
    publisher: {
      "@type": "Physician",
      name: loc.doctorName,
      medicalSpecialty: "https://schema.org/Orthopedic",
      image: SITE_URL + DOCTOR_PORTRAIT,
      url,
    },
  };
  tags.push(jsonLdScript(jsonLd));
  return tags.join("\n  ");
}

function buildAboutSeo(locale) {
  const loc = LOCALES_BY_CODE[locale];
  const url = localeUrl(loc, "about/");
  const image = SITE_URL + DOCTOR_PORTRAIT;
  const tags = commonOgTags({
    title: loc.aboutTitle,
    description: loc.aboutDescription,
    url,
    image,
    type: "profile",
    locale,
  });

  const urlsByLocale = {};
  for (const l of LOCALES) {
    if (fs.existsSync(path.join(ROOT, l.dir, "about", "index.html"))) {
      urlsByLocale[l.code] = localeUrl(l, "about/");
    }
  }
  tags.push(...hreflangTags(urlsByLocale));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: loc.doctorName,
    image,
    url,
    medicalSpecialty: "https://schema.org/Orthopedic",
    worksFor: { "@type": "Hospital", name: loc.hospitalName },
    alumniOf: loc.alumniOf,
  };
  tags.push(jsonLdScript(jsonLd));

  if (loc.faq && loc.faq.length) {
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: loc.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: Array.isArray(item.a) ? item.a.join("\n\n") : item.a,
        },
      })),
    };
    tags.push(jsonLdScript(faqJsonLd));
  }

  return tags.join("\n  ");
}

function injectSeo(filePath, seoHtml) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:SEO:START -->[\s\S]*?<!-- BUILD:SEO:END -->/;
  if (!re.test(html)) return;
  const replacement = `<!-- BUILD:SEO:START -->\n  ${seoHtml}\n  <!-- BUILD:SEO:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function buildSlugMap(articlesByLocale) {
  const map = new Map();
  for (const locale of LOCALES) {
    for (const a of articlesByLocale[locale.code]) {
      if (!map.has(a.slug)) map.set(a.slug, {});
      map.get(a.slug)[locale.code] = a;
    }
  }
  return map;
}

function updateAllSeo(articlesByLocale) {
  for (const locale of LOCALES) {
    injectSeo(path.join(ROOT, locale.dir, "index.html"), buildHomeSeo(locale.code));
    injectSeo(path.join(ROOT, locale.dir, "about", "index.html"), buildAboutSeo(locale.code));
  }

  const slugMap = buildSlugMap(articlesByLocale);
  for (const locale of LOCALES) {
    for (const article of articlesByLocale[locale.code]) {
      const html = fs.readFileSync(article.indexPath, "utf8");
      const counterparts = slugMap.get(article.slug) || {};
      injectSeo(article.indexPath, buildArticleSeo(article, html, locale.code, counterparts));
    }
  }
}

function writeRobotsTxt() {
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, "robots.txt"), content, "utf8");
}

function writeSitemap(articlesByLocale) {
  const staticPages = [
    { file: "index.html", suffix: "", priority: "1.0" },
    { file: path.join("about", "index.html"), suffix: "about/", priority: "0.8" },
    { file: path.join("media", "index.html"), suffix: "media/", priority: "0.6" },
    { file: path.join("line", "index.html"), suffix: "line/", priority: "0.4" },
    { file: path.join("privacy", "index.html"), suffix: "privacy/", priority: "0.2" },
  ];

  const staticUrls = [];
  for (const locale of LOCALES) {
    for (const page of staticPages) {
      const filePath = path.join(ROOT, locale.dir, page.file);
      if (locale.isDefault || fs.existsSync(filePath)) {
        staticUrls.push({ loc: localeUrl(locale, page.suffix), priority: page.priority });
      }
    }
  }

  const articleUrls = LOCALES.flatMap((l) => articlesByLocale[l.code]).map((a) => ({
    loc: `${SITE_URL}/${a.dir}/`,
    lastmod: a.updatedDate,
    priority: "0.7",
  }));

  const urlXml = [...staticUrls, ...articleUrls]
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${u.loc}</loc>${lastmod}\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlXml}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
}

function renderIndexRow(article, indexInGroup, locale) {
  const num = String(indexInGroup).padStart(2, "0");
  const newBadge = article.isNew
    ? `\n              <span class="index-badge-new">${escapeHtml(
        NEW_BADGE_LABEL[locale]
      )}</span>`
    : "";
  const thumb = article.thumbnail
    ? `<img class="index-thumb" src="${article.thumbnail}" alt="" width="100" height="70" loading="lazy" />\n            `
    : "";
  const linkClass = article.thumbnail ? "index-link index-link-with-thumb" : "index-link";
  return `        <div class="index-row">
          <span class="index-num">${num}</span>
          <a href="/${article.dir}/" class="${linkClass}">
            ${thumb}<div class="index-body">
              <h3 class="index-title">${escapeHtml(article.title)}</h3>
              <p class="index-excerpt">${escapeHtml(article.excerpt)}</p>
              <div class="index-meta">
                <span class="index-date">${article.publishedDate}</span>${newBadge}
              </div>
            </div>
          </a>
        </div>`;
}

function groupByCategory(articles, labels) {
  const groups = new Map();
  for (const article of articles) {
    const key = labels[article.category] ? article.category : "uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  }

  const order = [...CATEGORY_ORDER, "uncategorized"];
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({ key, label: labels[key], articles: groups.get(key) }));
}

function renderSection(group, locale) {
  const rowsHtml = group.articles
    .map((article, i) => renderIndexRow(article, i + 1, locale))
    .join("\n");
  const eyebrows = CATEGORY_EYEBROW[locale] || CATEGORY_CODES;
  const code = eyebrows[group.key] || eyebrows.uncategorized;
  return `    <section class="category-section" id="${escapeHtml(group.key)}">
      <span class="section-eyebrow">${escapeHtml(code)}</span>
      <h2 class="section-title">${escapeHtml(group.label)}</h2>
      <div class="index-list">
${rowsHtml}
      </div>
    </section>`;
}

const RELATED_HEADING = {
  zh: "延伸閱讀",
  en: "Further Reading",
  "zh-cn": "延伸阅读",
  vi: "Đọc Thêm",
  id: "Baca Juga",
};

// Articles published within this window show a "NEW" badge on the homepage
// instead of a view count (a freshly-published article's real view count is
// low by definition, which read as "nobody reads this" rather than "just
// published" — a badge signals the same thing without the discouraging number).
const NEW_BADGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const NEW_BADGE_LABEL = {
  zh: "最新",
  en: "New",
  "zh-cn": "最新",
  vi: "Mới",
  id: "Baru",
};

function pickRelated(article, allArticles, count = 3) {
  const others = allArticles.filter((a) => a !== article);
  const sameCategory = others.filter((a) => a.category === article.category);
  const rest = others.filter((a) => a.category !== article.category);
  return [...sameCategory, ...rest].slice(0, count);
}

function renderRelated(article, allArticles, locale) {
  const related = pickRelated(article, allArticles);
  if (!related.length) return "";
  const loc = LOCALES_BY_CODE[locale];
  const codes = loc.relatedChipStyle === "code" ? CATEGORY_CODES : loc.categoryLabels;
  const rowsHtml = related
    .map(
      (a) => `        <a href="/${a.dir}/" class="related-link">
          <span class="related-category">${escapeHtml(
            codes[a.category] || codes.uncategorized
          )}</span>
          <h4 class="related-title">${escapeHtml(a.title)}</h4>
        </a>`
    )
    .join("\n");
  return `      <aside class="related-articles">
        <h3 class="related-heading">${RELATED_HEADING[locale]}</h3>
        <div class="related-list">
${rowsHtml}
        </div>
      </aside>`;
}

function injectRelated(article, allArticles, locale) {
  const filePath = article.indexPath;
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:RELATED:START -->[\s\S]*?<!-- BUILD:RELATED:END -->/;
  if (!re.test(html)) return;
  const relatedHtml = renderRelated(article, allArticles, locale);
  const inner = relatedHtml
    ? `<!-- BUILD:RELATED:START -->\n${relatedHtml}\n      <!-- BUILD:RELATED:END -->`
    : `<!-- BUILD:RELATED:START -->\n      <!-- BUILD:RELATED:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildRssItems(articles) {
  return articles
    .map((a) => {
      const url = `${SITE_URL}/${a.dir}/`;
      const pubDate = new Date(`${a.publishedDate}T09:00:00+08:00`).toUTCString();
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(a.excerpt)}</description>
    </item>`;
    })
    .join("\n");
}

function writeRssFeed(articles, locale) {
  const loc = LOCALES_BY_CODE[locale];
  const siteUrl = localeUrl(loc);
  const feedUrl = `${siteUrl}rss.xml`;
  const itemsXml = buildRssItems(articles);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(loc.siteName)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(loc.rssDescription)}</description>
    <language>${loc.rssLanguage}</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>
`;
  const outPath = path.join(ROOT, loc.dir, "rss.xml");
  fs.writeFileSync(outPath, xml, "utf8");
}

function renderFriendLinks(locale) {
  if (!FRIEND_LINKS.length) return "";
  const linksHtml = FRIEND_LINKS.map((f) => {
    const label = f.labels[locale] || f.labels.en || f.labels.zh;
    return `<a href="${f.url}" target="_blank" rel="noopener">${escapeHtml(
      label
    )}</a>`;
  }).join("\n        ");
  return `      <div class="friend-links">
        <span class="friend-links-label">${FRIEND_LINKS_HEADING[locale]}</span>
        ${linksHtml}
      </div>`;
}

function injectFriendLinks(filePath, locale) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:FRIENDS:START -->[\s\S]*?<!-- BUILD:FRIENDS:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:FRIENDS:START -->\n${renderFriendLinks(
    locale
  )}\n      <!-- BUILD:FRIENDS:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function renderFaqSection(localeCode) {
  const loc = LOCALES_BY_CODE[localeCode];
  if (!loc.faq || !loc.faq.length) return "";
  const items = loc.faq
    .map((item) => {
      const paragraphs = Array.isArray(item.a) ? item.a : [item.a];
      const answerHtml = paragraphs
        .map((p) => `<p class="faq-answer">${escapeHtml(p)}</p>`)
        .join("\n          ");
      return `        <details class="faq-item">
          <summary class="faq-question">${escapeHtml(item.q)}</summary>
          ${answerHtml}
        </details>`;
    })
    .join("\n");
  return `      <div class="faq-block">
        <h2 class="faq-heading">${escapeHtml(loc.faqHeading)}</h2>
${items}
      </div>`;
}

function injectFaqSection(filePath, localeCode) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:FAQ:START -->[\s\S]*?<!-- BUILD:FAQ:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:FAQ:START -->\n${renderFaqSection(
    localeCode
  )}\n      <!-- BUILD:FAQ:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function renderGaScript() {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_MEASUREMENT_ID}');
  </script>`;
}

function injectGaScript(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:GA:START -->[\s\S]*?<!-- BUILD:GA:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:GA:START -->\n  ${renderGaScript()}\n  <!-- BUILD:GA:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function renderPrivacyFooterLink(localeCode) {
  const loc = LOCALES_BY_CODE[localeCode];
  const href = localeUrl(loc, "privacy/");
  return `<a href="${href}" class="privacy-link">${escapeHtml(loc.privacyLinkLabel)}</a>`;
}

function injectPrivacyFooterLink(filePath, localeCode) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:PRIVACYLINK:START -->[\s\S]*?<!-- BUILD:PRIVACYLINK:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:PRIVACYLINK:START -->${renderPrivacyFooterLink(
    localeCode
  )}<!-- BUILD:PRIVACYLINK:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function renderSubscribeForm(localeCode) {
  const copy = LOCALES_BY_CODE[localeCode].subscribeCopy;
  return `      <div class="subscribe-block">
        <span class="subscribe-block-label">${escapeHtml(copy.label)}</span>
        <h2 class="subscribe-block-heading">${escapeHtml(copy.heading)}</h2>
        <p class="subscribe-block-desc">${escapeHtml(copy.desc)}</p>
        <form class="subscribe-form" data-locale="${localeCode}" data-success-msg="${escapeHtml(
    copy.success
  )}" data-error-msg="${escapeHtml(copy.error)}" data-invalid-msg="${escapeHtml(copy.invalid)}">
          <div class="subscribe-honeypot" aria-hidden="true">
            <label for="subscribe-website">Website</label>
            <input type="text" id="subscribe-website" name="website" tabindex="-1" autocomplete="off" />
          </div>
          <input type="email" class="subscribe-input" name="email" placeholder="${escapeHtml(
            copy.placeholder
          )}" aria-label="${escapeHtml(copy.placeholder)}" required />
          <button type="submit" class="subscribe-submit">${escapeHtml(copy.submit)}</button>
        </form>
        <p class="subscribe-status" role="status" aria-live="polite"></p>
      </div>`;
}

function injectSubscribeForm(filePath, localeCode) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:SUBSCRIBE:START -->[\s\S]*?<!-- BUILD:SUBSCRIBE:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:SUBSCRIBE:START -->\n${renderSubscribeForm(
    localeCode
  )}\n      <!-- BUILD:SUBSCRIBE:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

// availability is a sparse {localeCode: relativeUrl} map for this exact
// page (a static page or a specific article's counterparts). A locale
// missing from the map renders as a disabled, unclickable entry instead of
// a link to a page that doesn't exist yet.
function renderLangSwitch(currentLocaleCode, availability) {
  const current = LOCALES_BY_CODE[currentLocaleCode];
  const itemsHtml = LOCALES.map((l) => {
    const href = availability[l.code];
    if (l.code === currentLocaleCode) {
      return `          <a href="${href}" aria-current="true">${escapeHtml(
        l.langSwitchSelfLabel
      )}</a>`;
    }
    if (href) {
      return `          <a href="${href}">${escapeHtml(l.langSwitchSelfLabel)}</a>`;
    }
    return `          <span class="lang-switch-disabled" aria-disabled="true">${escapeHtml(
      l.langSwitchSelfLabel
    )}</span>`;
  }).join("\n");

  return `<div class="lang-switch">
        <button type="button" class="lang-switch-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="lang-switch-menu"><span class="lang-switch-icon" aria-hidden="true">${LANG_SWITCH_ICON_SVG}</span>${escapeHtml(
          current.langSwitchSelfLabel
        )}</button>
        <div class="lang-switch-menu" id="lang-switch-menu">
${itemsHtml}
        </div>
      </div>`;
}

function injectLangSwitch(filePath, currentLocaleCode, availability) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:LANGSWITCH:START -->[\s\S]*?<!-- BUILD:LANGSWITCH:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:LANGSWITCH:START -->${renderLangSwitch(
    currentLocaleCode,
    availability
  )}<!-- BUILD:LANGSWITCH:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

function renderBookingSwitch(localeCode) {
  const loc = LOCALES_BY_CODE[localeCode];
  return `<div class="booking-switch">
        <button type="button" class="booking-switch-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="booking-switch-menu">${escapeHtml(
          loc.bookingToggleLabel
        )}<span class="booking-switch-caret" aria-hidden="true">&#9662;</span></button>
        <div class="booking-switch-menu" id="booking-switch-menu">
          <a href="${VGHTC_BOOKING_URL}" target="_blank" rel="noopener">${escapeHtml(
            loc.hospitalNameShort
          )}</a>
          <a href="${BCH_BOOKING_URL}" target="_blank" rel="noopener">${escapeHtml(
            loc.secondHospitalNameShort
          )}</a>
        </div>
      </div>`;
}

function injectBookingSwitch(filePath, localeCode) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  const re = /<!-- BUILD:BOOKING:START -->[\s\S]*?<!-- BUILD:BOOKING:END -->/;
  if (!re.test(html)) return;
  const inner = `<!-- BUILD:BOOKING:START -->${renderBookingSwitch(
    localeCode
  )}<!-- BUILD:BOOKING:END -->`;
  const next = html.replace(re, inner);
  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

// Computes a {localeCode: relativeUrl} map for one static page type (home,
// about, media, or line) by checking which locales actually have that file.
function staticPageAvailability(pageFile, suffix) {
  const availability = {};
  for (const l of LOCALES) {
    if (fs.existsSync(path.join(ROOT, l.dir, pageFile))) {
      availability[l.code] = localePath(l, suffix);
    }
  }
  return availability;
}

function updateHomepageCards(articles, indexPath, labels, locale) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");
  const re = /<!-- BUILD:CARDS:START -->[\s\S]*?<!-- BUILD:CARDS:END -->/;
  if (!re.test(html)) {
    throw new Error(`BUILD:CARDS markers not found in ${indexPath}`);
  }
  const groups = groupByCategory(articles, labels);
  const sectionsHtml = groups.map((group) => renderSection(group, locale)).join("\n\n");
  const replacement = `<!-- BUILD:CARDS:START -->\n${sectionsHtml}\n    <!-- BUILD:CARDS:END -->`;
  const next = html.replace(re, replacement);
  if (next !== html) {
    fs.writeFileSync(indexPath, next, "utf8");
  }
}

// Static assets (CSS/JS/hero image) are served with a long browser cache
// (Cache-Control: max-age=14400) and no per-file versioning, so a deploy
// alone doesn't make already-cached visitors see the change for up to 4
// hours. Appending a content-derived ?v= query string to every reference
// changes the URL whenever the underlying file changes, which busts the
// cache immediately without needing to touch Cloudflare's cache settings.
const VERSIONED_ASSETS = [
  "assets/css/style.css",
  "assets/js/supabase-config.js",
  "assets/js/counter.js",
  "assets/js/subscribe.js",
  "assets/js/subscribe-action.js",
  "assets/js/adaptive-reading.js",
  "assets/js/mobile-nav.js",
  "assets/js/lang-switch.js",
  "assets/js/booking-switch.js",
  "assets/images/hero-cover.jpg",
  "assets/images/hero-cover.webp",
];

function computeAssetVersion() {
  const hash = crypto.createHash("md5");
  for (const rel of VERSIONED_ASSETS) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) hash.update(fs.readFileSync(abs));
  }
  return hash.digest("hex").slice(0, 10);
}

// Directories whose HTML is intentionally left out of asset versioning:
// idea-capture-* is a private, unlisted page that must not be touched by
// any automated pass (see CLAUDE.md), and the usual build-output/tooling
// dirs aren't page content at all.
const VERSIONING_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  "dist",
  "supabase",
  "scripts",
  "assets",
]);

function findAllHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (VERSIONING_SKIP_DIRS.has(entry.name) || entry.name.startsWith("idea-capture-")) continue;
      results.push(...findAllHtmlFiles(path.join(dir, entry.name)));
    } else if (entry.name === "index.html") {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function applyAssetVersion(filePath, version) {
  let html = fs.readFileSync(filePath, "utf8");
  const before = html;
  for (const rel of VERSIONED_ASSETS) {
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(["'/]${escaped})(\\?v=[a-f0-9]+)?(["'])`, "g");
    html = html.replace(re, `$1?v=${version}$3`);
  }
  if (html !== before) fs.writeFileSync(filePath, html, "utf8");
}

function versionAllAssets() {
  const version = computeAssetVersion();
  const files = findAllHtmlFiles(ROOT);
  files.forEach((f) => applyAssetVersion(f, version));
  console.log(`Applied asset version ?v=${version} to ${files.length} page(s).`);
}

function main() {
  const articlesByLocale = findAllArticles();

  for (const locale of LOCALES) {
    const articles = articlesByLocale[locale.code];
    articles.forEach(updateArticleUpdatedMarker);
    articles.forEach((a) => updateArticleCategoryLabel(a, locale.categoryLabels));
    updateHomepageCards(
      articles,
      path.join(ROOT, locale.dir, "index.html"),
      locale.categoryLabels,
      locale.code
    );
    articles.forEach((a) => injectRelated(a, articles, locale.code));
  }

  for (const locale of LOCALES) {
    injectFriendLinks(path.join(ROOT, locale.dir, "index.html"), locale.code);
    injectFriendLinks(path.join(ROOT, locale.dir, "about", "index.html"), locale.code);
    injectFriendLinks(path.join(ROOT, locale.dir, "media", "index.html"), locale.code);
    injectFriendLinks(path.join(ROOT, locale.dir, "line", "index.html"), locale.code);
    injectFriendLinks(path.join(ROOT, locale.dir, "privacy", "index.html"), locale.code);
    articlesByLocale[locale.code].forEach((a) => injectFriendLinks(a.indexPath, locale.code));

    injectPrivacyFooterLink(path.join(ROOT, locale.dir, "index.html"), locale.code);
    injectPrivacyFooterLink(path.join(ROOT, locale.dir, "about", "index.html"), locale.code);
    injectPrivacyFooterLink(path.join(ROOT, locale.dir, "media", "index.html"), locale.code);
    injectPrivacyFooterLink(path.join(ROOT, locale.dir, "line", "index.html"), locale.code);
    injectPrivacyFooterLink(path.join(ROOT, locale.dir, "privacy", "index.html"), locale.code);
    articlesByLocale[locale.code].forEach((a) => injectPrivacyFooterLink(a.indexPath, locale.code));
    injectPrivacyFooterLink(
      path.join(ROOT, locale.dir, "subscribe", "confirmed", "index.html"),
      locale.code
    );
    injectPrivacyFooterLink(
      path.join(ROOT, locale.dir, "subscribe", "unsubscribed", "index.html"),
      locale.code
    );

    // Homepage lower-middle + bottom of every article page only — not the
    // about/media/line static pages.
    injectSubscribeForm(path.join(ROOT, locale.dir, "index.html"), locale.code);
    articlesByLocale[locale.code].forEach((a) => injectSubscribeForm(a.indexPath, locale.code));

    injectFaqSection(path.join(ROOT, locale.dir, "about", "index.html"), locale.code);
  }

  const homeAvailability = staticPageAvailability("index.html", "");
  const aboutAvailability = staticPageAvailability(path.join("about", "index.html"), "about/");
  const mediaAvailability = staticPageAvailability(path.join("media", "index.html"), "media/");
  const lineAvailability = staticPageAvailability(path.join("line", "index.html"), "line/");
  const privacyAvailability = staticPageAvailability(path.join("privacy", "index.html"), "privacy/");
  const slugMap = buildSlugMap(articlesByLocale);

  for (const locale of LOCALES) {
    injectLangSwitch(path.join(ROOT, locale.dir, "index.html"), locale.code, homeAvailability);
    injectLangSwitch(
      path.join(ROOT, locale.dir, "about", "index.html"),
      locale.code,
      aboutAvailability
    );
    injectLangSwitch(
      path.join(ROOT, locale.dir, "media", "index.html"),
      locale.code,
      mediaAvailability
    );
    injectLangSwitch(path.join(ROOT, locale.dir, "line", "index.html"), locale.code, lineAvailability);
    injectLangSwitch(
      path.join(ROOT, locale.dir, "privacy", "index.html"),
      locale.code,
      privacyAvailability
    );

    injectBookingSwitch(path.join(ROOT, locale.dir, "index.html"), locale.code);
    injectBookingSwitch(path.join(ROOT, locale.dir, "about", "index.html"), locale.code);
    injectBookingSwitch(path.join(ROOT, locale.dir, "media", "index.html"), locale.code);
    injectBookingSwitch(path.join(ROOT, locale.dir, "line", "index.html"), locale.code);
    injectBookingSwitch(path.join(ROOT, locale.dir, "privacy", "index.html"), locale.code);

    articlesByLocale[locale.code].forEach((a) => {
      const counterparts = slugMap.get(a.slug) || {};
      const availability = {};
      for (const l of LOCALES) {
        if (counterparts[l.code]) availability[l.code] = `/${counterparts[l.code].dir}/`;
      }
      injectLangSwitch(a.indexPath, locale.code, availability);
      injectBookingSwitch(a.indexPath, locale.code);
    });
  }

  updateAllSeo(articlesByLocale);
  writeRobotsTxt();
  writeSitemap(articlesByLocale);
  for (const locale of LOCALES) {
    if (locale.isDefault || fs.existsSync(path.join(ROOT, locale.dir))) {
      writeRssFeed(articlesByLocale[locale.code], locale.code);
    }
  }

  versionAllAssets();

  findAllHtmlFiles(ROOT).forEach(injectGaScript);

  console.log(`Built ${LOCALES.length} configured locale(s):`);
  for (const locale of LOCALES) {
    const articles = articlesByLocale[locale.code];
    console.log(`  ${locale.code}: ${articles.length} article(s)`);
    articles.forEach((a) => console.log(`    - ${a.dir} (updated ${a.updatedDate})`));
  }
}

main();
