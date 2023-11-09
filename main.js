const { default: axios } = require("axios");

async function main() {
  try {
    // const a = await axios.post("http://localhost:8080/test", {
    //   email: "wlstjsdn12@g.skku.edu",
    // });
    const a = await axios.get(
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=waniwani_0602"
    );

    console.log(a.data);
  } catch (err) {
    console.log(err.response);
  }
}

main();
